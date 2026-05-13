import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";

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

export default function SalesRecordForCommissionPage({ currentUser }) {
  const [tab, setTab] = useState("new"); // 'new' | 'history'
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [salesRows, setSalesRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [saveDialog, setSaveDialog] = useState(false);
  const [saveMonth, setSaveMonth] = useState(firstOfMonth());
  const [saving, setSaving] = useState(false);

  // History tab state
  const [historyRows, setHistoryRows] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);

  // Branch filter (map 00000 → SCY01)
  const [branchFilter, setBranchFilter] = useState("");
  const normBranch = (b) => (b === "00000" ? "SCY01" : (b || "(ไม่มี)"));
  const branchOptions = Array.from(new Set(salesRows.map(r => normBranch(r.branch_code)))).sort();
  const filteredRows = branchFilter ? salesRows.filter(r => normBranch(r.branch_code) === branchFilter) : salesRows;

  // Pagination
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [salesRows, branchFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function fetchHistory() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "list_commission_sales_records" });
      setHistoryRows(Array.isArray(data) ? data.filter(r => r && r.month_year) : []);
    } catch { setHistoryRows([]); setMessage("❌ โหลดประวัติไม่สำเร็จ"); }
    setLoading(false);
  }

  async function openHistoryDetail(month_year) {
    setHistoryDetail({ month_year, rows: [], loading: true });
    try {
      const data = await postAPI({ action: "get_commission_sales_record_detail", month_year: month_year + "-01" });
      setHistoryDetail({ month_year, rows: Array.isArray(data) ? data.filter(r => r && r.id) : [], loading: false });
    } catch { setHistoryDetail({ month_year, rows: [], loading: false }); }
  }

  async function deleteMonth(month_year, count) {
    if (!window.confirm(`ลบประวัติเดือน ${month_year} (${count} รายการ) ?`)) return;
    try {
      await postAPI({ action: "delete_commission_sales_record_month", month_year: month_year + "-01" });
      setMessage(`✅ ลบประวัติเดือน ${month_year} แล้ว`);
      fetchHistory();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  useEffect(() => { if (tab === "history") fetchHistory(); /* eslint-disable-next-line */ }, [tab]);

  async function saveSnapshot() {
    if (!saveMonth) { setMessage("❌ กรุณาเลือกเดือน"); return; }
    if (filteredRows.length === 0) { setMessage("❌ ไม่มีรายการให้บันทึก"); return; }
    setSaving(true);
    try {
      const res = await postAPI({
        action: "save_commission_sales_record",
        month_year: saveMonth,
        items: filteredRows.map(r => ({
          sale_id: r.sale_id, sale_date: r.sale_date, invoice_no: r.invoice_no,
          invoice_type: r.invoice_type, customer_name: r.customer_name,
          brand: r.brand, model_series: r.model_series, model_code: r.model_code,
          chassis_no: r.chassis_no,
          branch_code: r.branch_code === "00000" ? "SCY01" : r.branch_code,
        })),
        saved_by: currentUser?.username || currentUser?.name || "system",
      });
      const first = Array.isArray(res) ? res[0] : res;
      const n = first?.inserted ?? "?";
      const err = first?.error_msg;
      if (err) setMessage(`❌ ${err}`);
      else setMessage(`✅ บันทึก ${n} รายการสำหรับเดือน ${saveMonth}`);
      setSaveDialog(false);
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "list_all_sales", date_from: dateFrom, date_to: dateTo });
      setSalesRows(Array.isArray(data) ? data.filter(r => r && r.sale_id) : []);
    } catch { setSalesRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const byBranch = {};
  salesRows.forEach(r => {
    const b = r.branch_code || "(ไม่มีสาขา)";
    if (!byBranch[b]) byBranch[b] = { branch: b, total: 0, retail: 0, finance: 0, other: 0, total_amount: 0 };
    byBranch[b].total += 1;
    byBranch[b].total_amount += Number(r.total_amount || 0);
    if (r.invoice_type === "ขายปลีก") byBranch[b].retail += 1;
    else if (r.invoice_type === "ขายไฟแนนซ์") byBranch[b].finance += 1;
    else byBranch[b].other += 1;
  });
  const branches = Object.values(byBranch).sort((a, b) => a.branch.localeCompare(b.branch));
  const grandTotal = salesRows.length;
  const grandAmount = salesRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📋 บันทึกรถคำนวณค่าคอม</h2>
      </div>

      <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["new", "📝 บันทึกใหม่"],
          ["history", "📚 ประวัติการบันทึก"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{
              padding: "10px 18px", border: "none", background: "transparent",
              fontWeight: tab === v ? 700 : 500, fontSize: 14, cursor: "pointer",
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2,
            }}>{label}</button>
        ))}
      </div>

      {tab === "new" && (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <span>สาขา:</span>
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ ...inp, minWidth: 110 }}>
          <option value="">ทุกสาขา ({salesRows.length})</option>
          {branchOptions.map(b => (
            <option key={b} value={b}>{b} ({salesRows.filter(r => normBranch(r.branch_code) === b).length})</option>
          ))}
        </select>
        <button onClick={() => setSaveDialog(true)} disabled={filteredRows.length === 0} style={{ ...btnBlue, background: filteredRows.length === 0 ? "#9ca3af" : "#059669", marginLeft: "auto" }}>
          💾 บันทึกเดือนที่ขาย ({filteredRows.length})
        </button>
      </div>
      )}

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      {tab === "history" && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: "#072d6b" }}>📚 ประวัติการบันทึก ({historyRows.length} เดือน)</div>
            <button onClick={fetchHistory} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>เดือน</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวนรายการ</th>
                <th style={th}>บันทึกครั้งแรก</th>
                <th style={th}>บันทึกล่าสุด</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
              {!loading && historyRows.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติการบันทึก</td></tr>}
              {historyRows.map((r, i) => (
                <tr key={r.month_year} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{r.month_year}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#059669" }}>{r.total_records}</td>
                  <td style={td}>{r.first_saved ? new Date(r.first_saved).toLocaleString("th-TH") : "-"}</td>
                  <td style={td}>{r.last_saved ? new Date(r.last_saved).toLocaleString("th-TH") : "-"}</td>
                  <td style={td}>{r.last_saved_by || "-"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => openHistoryDetail(r.month_year)}
                      style={{ padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>📋 ดู</button>
                    <button onClick={() => deleteMonth(r.month_year, r.total_records)}
                      style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑️ ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "new" && (<>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 12 }}>
        <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📄 รายการขาย ({salesRows.length} ใบ — ไม่รวมขายส่ง)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff", position: "sticky", top: 0 }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>วันที่</th>
                <th style={th}>เลขใบขาย</th>
                <th style={th}>ประเภท</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>รุ่น</th>
                <th style={th}>เลขตัวถัง</th>
                <th style={th}>สาขา</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
                <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
              {!loading && salesRows.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
              {pagedRows.map((r, i) => (
                <tr key={r.sale_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={td}>{fmtDate(r.sale_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                  <td style={td}>{r.invoice_type || "-"}</td>
                  <td style={td}>{r.customer_name || "-"}</td>
                  <td style={td}>{[r.brand, r.model_series].filter(Boolean).join(" · ")}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{normBranch(r.branch_code)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_amount)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => {
                        if (window.confirm(`ลบรายการ ${r.invoice_no} ออกจากการบันทึก?`)) {
                          setSalesRows(prev => prev.filter(x => x.sale_id !== r.sale_id));
                        }
                      }}
                      title="ลบแถวออกจากการบันทึก (ไม่กระทบข้อมูลจริงใน DB)"
                      style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                      🗑️ ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={pgBtn(page === 1)}>« หน้าแรก</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn(page === 1)}>‹ ก่อนหน้า</button>
            {(() => {
              const pages = [];
              const start = Math.max(1, page - 2);
              const end = Math.min(totalPages, start + 4);
              for (let i = start; i <= end; i++) {
                pages.push(
                  <button key={i} onClick={() => setPage(i)}
                    style={{ ...pgBtn(false), background: page === i ? "#072d6b" : "#fff", color: page === i ? "#fff" : "#374151", fontWeight: page === i ? 700 : 500 }}>{i}</button>
                );
              }
              return pages;
            })()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtn(page === totalPages)}>ถัดไป ›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={pgBtn(page === totalPages)}>หน้าสุดท้าย »</button>
            <span style={{ marginLeft: 12, fontSize: 12, color: "#6b7280" }}>หน้า {page} / {totalPages} · ทั้งหมด {salesRows.length} รายการ</span>
          </div>
        )}
      </div>
      </>)}

      {historyDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}
             onClick={() => setHistoryDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1300, width: "95%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 ประวัติการบันทึก เดือน {historyDetail.month_year} ({historyDetail.rows.length} รายการ)</h3>
              <button onClick={() => setHistoryDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {historyDetail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>วันที่</th>
                    <th style={th}>เลขใบขาย</th>
                    <th style={th}>ประเภท</th>
                    <th style={th}>ลูกค้า</th>
                    <th style={th}>รุ่น</th>
                    <th style={th}>เลขตัวถัง</th>
                    <th style={th}>สาขา</th>
                  </tr>
                </thead>
                <tbody>
                  {historyDetail.rows.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{fmtDate(r.sale_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                      <td style={td}>{r.invoice_type || "-"}</td>
                      <td style={td}>{r.customer_name || "-"}</td>
                      <td style={td}>{[r.brand, r.model_series].filter(Boolean).join(" · ")}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {saveDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}
             onClick={() => !saving && setSaveDialog(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 440, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", color: "#15803d", textAlign: "center" }}>💾 ยืนยันบันทึกเดือนที่ขาย</h3>
            <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 14, textAlign: "center" }}>
              จะบันทึก <strong style={{ color: "#15803d", fontSize: 18 }}>{filteredRows.length}</strong> รายการ {branchFilter && `(สาขา ${branchFilter})`}
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>ช่วงข้อมูล: {dateFrom} ถึง {dateTo}</div>
            </div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📅 เดือนที่ใช้คำนวณค่าคอม</label>
            <input type="month" value={saveMonth.slice(0, 7)} onChange={e => setSaveMonth(e.target.value + "-01")} style={{ ...inp, width: "100%", marginBottom: 14 }} />
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
              💡 รายการที่บันทึกซ้ำ (sale_id + month) จะถูกอัปเดต (ไม่ซ้ำ)
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setSaveDialog(false)} disabled={saving} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveSnapshot} disabled={saving} style={{ padding: "8px 20px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "✅ ยืนยันบันทึก"}
              </button>
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
const pgBtn = (disabled) => ({
  padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 5,
  background: disabled ? "#f3f4f6" : "#fff", color: disabled ? "#9ca3af" : "#374151",
  cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, minWidth: 36, fontFamily: "Tahoma",
});
