import React, { useEffect, useRef, useState } from "react";

// n8n endpoint — ใช้ action-based เหมือนหน้าอื่นในระบบ
const PAY_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/payment-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 16);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const PAYMENT_TYPES = [
  { value: "general", label: "รับชำระทั่วไป" },
  { value: "repair", label: "ค่าซ่อม" },
];

const emptyForm = () => ({
  payment_type: "general",
  ref_no: "",
  customer_name: "",
  customer_phone: "",
  amount: "",
  description: "",
});

const STATUS_LABEL = {
  pending: { text: "⏳ รอชำระเงิน", color: "#b45309", bg: "#fef3c7" },
  paid: { text: "✅ ชำระแล้ว", color: "#065f46", bg: "#d1fae5" },
  failed: { text: "❌ ชำระไม่สำเร็จ", color: "#991b1b", bg: "#fee2e2" },
  expired: { text: "⏱️ QR หมดอายุ", color: "#374151", bg: "#e5e7eb" },
  cancelled: { text: "🚫 ยกเลิก", color: "#374151", bg: "#e5e7eb" },
};

export default function PaymentPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState("charge"); // 'charge' | 'summary'
  const [form, setForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);
  const [charge, setCharge] = useState(null);   // { charge_id, qr_image, amount, status, expires_at, created_at }
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());

  const pollRef = useRef(null);
  const userBranch = String(currentUser?.branch || "").trim();
  const userBranchCode = userBranch.includes(" ") ? userBranch.split(" ")[0] : userBranch;
  const userBranchName = userBranch.includes(" ") ? userBranch.split(" ").slice(1).join(" ") : userBranch;

  useEffect(() => {
    const d = new Date();
    setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) fetchHistory();
    // eslint-disable-next-line
  }, [dateFrom, dateTo]);

  // ticker สำหรับ countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // cleanup polling ตอน unmount
  useEffect(() => () => stopPolling(), []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(chargeId) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(PAY_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_payment_status", charge_id: chargeId }),
        });
        const data = await res.json();
        const row = Array.isArray(data) ? data[0] : data;
        if (!row || !row.status) return;
        setCharge(prev => prev && prev.charge_id === chargeId ? { ...prev, ...row } : prev);
        if (row.status !== "pending") {
          stopPolling();
          fetchHistory();
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  async function fetchHistory() {
    setLoadingHist(true);
    try {
      const body = {
        action: "list_payments",
        date_from: dateFrom,
        date_to: dateTo,
        branch_code: userBranchCode || "",
      };
      const res = await fetch(PAY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
    setLoadingHist(false);
  }

  async function handleCreateQR() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { setMessage("❌ กรอกจำนวนเงินให้ถูกต้อง"); return; }
    if (!form.customer_name.trim()) { setMessage("❌ กรอกชื่อลูกค้า"); return; }

    setCreating(true);
    setMessage("");
    try {
      const body = {
        action: "create_promptpay_qr",
        amount: amt,
        payment_type: form.payment_type,
        ref_no: form.ref_no.trim(),
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        description: form.description.trim(),
        created_by: currentUser?.username || currentUser?.name || "system",
        branch_code: userBranchCode,
        branch_name: userBranchName,
      };
      const res = await fetch(PAY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.charge_id) {
        setMessage(`❌ สร้าง QR ไม่สำเร็จ: ${row?.error || "no response"}`);
        setCreating(false);
        return;
      }
      setCharge({
        charge_id: row.charge_id,
        qr_image: row.qr_image,           // data URL หรือ URL รูป QR
        amount: row.amount || amt,
        status: row.status || "pending",
        expires_at: row.expires_at,
        created_at: row.created_at || new Date().toISOString(),
        ref_no: row.ref_no || form.ref_no,
        customer_name: row.customer_name || form.customer_name,
      });
      startPolling(row.charge_id);
      setMessage("");
    } catch (e) {
      setMessage(`❌ สร้าง QR ไม่สำเร็จ: ${e.message || e}`);
    }
    setCreating(false);
  }

  async function handleCancelCharge() {
    if (!charge?.charge_id) return;
    if (!window.confirm("ยกเลิกรายการนี้?")) return;
    try {
      await fetch(PAY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_payment", charge_id: charge.charge_id }),
      });
    } catch { /* ignore */ }
    stopPolling();
    setCharge(null);
    setForm(emptyForm());
    fetchHistory();
  }

  function handleNewPayment() {
    stopPolling();
    setCharge(null);
    setForm(emptyForm());
    setMessage("");
  }

  // countdown สำหรับ QR
  const expiresInSec = charge?.expires_at
    ? Math.max(0, Math.floor((new Date(charge.expires_at).getTime() - now) / 1000))
    : null;
  const isExpired = charge?.status === "pending" && expiresInSec === 0;

  useEffect(() => {
    if (isExpired) {
      stopPolling();
      setCharge(prev => prev ? { ...prev, status: "expired" } : prev);
    }
  }, [isExpired]);

  const filtered = history.filter(r => {
    if (!search.trim()) return true;
    const kw = search.trim().toLowerCase();
    return [r.charge_id, r.ref_no, r.customer_name, r.customer_phone, r.description]
      .filter(Boolean).join(" ").toLowerCase().includes(kw);
  });

  const paidTotal = filtered.filter(r => r.status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 รับชำระเงิน (QR PromptPay)</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 14 }}>
        <button
          onClick={() => setActiveTab("charge")}
          style={{
            padding: "10px 22px", border: "none", background: activeTab === "charge" ? "#0369a1" : "transparent",
            color: activeTab === "charge" ? "#fff" : "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer",
            borderTopLeftRadius: 8, borderTopRightRadius: 8, marginBottom: -2,
          }}
        >
          💸 รับชำระเงิน
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          style={{
            padding: "10px 22px", border: "none", background: activeTab === "summary" ? "#0369a1" : "transparent",
            color: activeTab === "summary" ? "#fff" : "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer",
            borderTopLeftRadius: 8, borderTopRightRadius: 8, marginBottom: -2,
          }}
        >
          📊 ประวัติสรุปยอด
        </button>
      </div>

      {activeTab === "summary" && (
        <SummaryTab currentUser={currentUser} />
      )}

      {activeTab === "charge" && (<>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        {/* ฟอร์มกรอก */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#072d6b" }}>📋 รายละเอียดการชำระ</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>ประเภท *</label>
              <select
                value={form.payment_type}
                onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
                disabled={!!charge}
                style={inp2}
              >
                {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>เลขที่อ้างอิง (ใบงาน/ใบซ่อม)</label>
              <input
                type="text"
                value={form.ref_no}
                onChange={e => setForm(p => ({ ...p, ref_no: e.target.value }))}
                disabled={!!charge}
                style={inp2}
              />
            </div>
            <div>
              <label style={lbl}>ชื่อลูกค้า *</label>
              <input
                type="text"
                value={form.customer_name}
                onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                disabled={!!charge}
                style={inp2}
              />
            </div>
            <div>
              <label style={lbl}>เบอร์ลูกค้า</label>
              <input
                type="tel"
                value={form.customer_phone}
                onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                disabled={!!charge}
                style={inp2}
              />
            </div>
            <div>
              <label style={lbl}>จำนวนเงิน (บาท) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                disabled={!!charge}
                style={{ ...inp2, fontSize: 18, fontWeight: 700, color: "#059669" }}
              />
            </div>
            <div>
              <label style={lbl}>สาขา</label>
              <input type="text" value={`${userBranchCode} ${userBranchName}`} disabled style={{ ...inp2, background: "#f3f4f6" }} />
            </div>
            <div style={{ gridColumn: "1 / span 2" }}>
              <label style={lbl}>หมายเหตุ</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                disabled={!!charge}
                rows={2}
                style={{ ...inp2, resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            {!charge ? (
              <button
                onClick={handleCreateQR}
                disabled={creating}
                style={{ padding: "10px 26px", background: creating ? "#9ca3af" : "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: creating ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14 }}
              >
                {creating ? "กำลังสร้าง QR..." : "📱 สร้าง QR PromptPay"}
              </button>
            ) : (
              <>
                {charge.status === "pending" && (
                  <button onClick={handleCancelCharge} style={{ padding: "10px 20px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                    ยกเลิก
                  </button>
                )}
                <button onClick={handleNewPayment} style={{ padding: "10px 20px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                  ➕ รายการใหม่
                </button>
              </>
            )}
          </div>
        </div>

        {/* แสดง QR / สถานะ */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360 }}>
          {!charge ? (
            <div style={{ color: "#9ca3af", textAlign: "center" }}>
              <div style={{ fontSize: 60, marginBottom: 10 }}>📱</div>
              <div>กรอกข้อมูลแล้วกดสร้าง QR PromptPay</div>
            </div>
          ) : (
            <>
              <div style={{ width: "100%", marginBottom: 10, padding: "6px 12px", borderRadius: 6, textAlign: "center", fontWeight: 700, color: STATUS_LABEL[charge.status]?.color, background: STATUS_LABEL[charge.status]?.bg }}>
                {STATUS_LABEL[charge.status]?.text || charge.status}
              </div>

              {charge.status === "pending" && charge.qr_image && (
                <>
                  <img src={charge.qr_image} alt="QR PromptPay" style={{ width: 240, height: 240, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }} />
                  {expiresInSec != null && (
                    <div style={{ marginTop: 8, fontSize: 12, color: expiresInSec < 60 ? "#b91c1c" : "#6b7280" }}>
                      หมดอายุใน: <strong>{Math.floor(expiresInSec / 60)}:{String(expiresInSec % 60).padStart(2, "0")}</strong>
                    </div>
                  )}
                </>
              )}

              {charge.status === "paid" && (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <div style={{ fontSize: 80 }}>✅</div>
                  <div style={{ fontWeight: 700, color: "#065f46", marginTop: 6 }}>รับชำระเงินสำเร็จ</div>
                  {charge.paid_at && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{fmtDateTime(charge.paid_at)}</div>}
                </div>
              )}

              {(charge.status === "expired" || charge.status === "failed" || charge.status === "cancelled") && (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <div style={{ fontSize: 80 }}>{charge.status === "expired" ? "⏱️" : "❌"}</div>
                  <div style={{ fontWeight: 700, color: "#991b1b", marginTop: 6 }}>{STATUS_LABEL[charge.status]?.text}</div>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, color: "#059669" }}>
                {fmt(charge.amount)} บาท
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                ID: {charge.charge_id}
              </div>
              {charge.customer_name && (
                <div style={{ marginTop: 4, fontSize: 12, color: "#374151" }}>
                  ลูกค้า: <strong>{charge.customer_name}</strong>
                  {charge.ref_no && <> · อ้างอิง <strong>{charge.ref_no}</strong></>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ประวัติการชำระเงิน */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#072d6b" }}>📜 ประวัติการชำระเงิน</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>วันที่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา (ลูกค้า, อ้างอิง, charge id)" style={{ ...inp, flex: 1, minWidth: 220 }} />
        <button onClick={fetchHistory} disabled={loadingHist} style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loadingHist ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 18, marginBottom: 10, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
        <span>📋 รายการ: <strong>{filtered.length}</strong></span>
        <span>💰 ชำระสำเร็จรวม: <strong style={{ color: "#059669" }}>{fmt(paidTotal)}</strong> บาท</span>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {loadingHist ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>วันที่/เวลา</th>
                <th style={th}>ประเภท</th>
                <th style={th}>อ้างอิง</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>เบอร์</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวนเงิน</th>
                <th style={th}>สถานะ</th>
                <th style={th}>Charge ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.charge_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{fmtDateTime(r.created_at)}</td>
                  <td style={td}>{PAYMENT_TYPES.find(t => t.value === r.payment_type)?.label || r.payment_type || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.ref_no || "-"}</td>
                  <td style={td}>{r.customer_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.customer_phone || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: r.status === "paid" ? "#059669" : "#6b7280" }}>{fmt(r.amount)}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: STATUS_LABEL[r.status]?.color, background: STATUS_LABEL[r.status]?.bg }}>
                      {STATUS_LABEL[r.status]?.text || r.status}
                    </span>
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>{r.charge_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </>)}
    </div>
  );
}

// =====================================================
// Tab: ประวัติสรุปยอด — filter + group by + checkbox + ปุ่มสรุป
// =====================================================
function SummaryTab({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("paid");
  const [filterType, setFilterType] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterCreator, setFilterCreator] = useState("");
  const [groupBy, setGroupBy] = useState("day"); // day | month | branch | creator | type
  const [selected, setSelected] = useState({}); // {charge_id: true}
  const [summary, setSummary] = useState(null); // { total, count, groups: [{key, label, total, count}] }

  const isAdmin = currentUser?.role === "admin";
  const userBranch = String(currentUser?.branch || "").trim();
  const userBranchCode = userBranch.includes(" ") ? userBranch.split(" ")[0] : userBranch;

  useEffect(() => {
    const d = new Date();
    setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    if (!isAdmin && userBranchCode) setFilterBranch(userBranchCode);
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) fetchData();
    // eslint-disable-next-line
  }, [dateFrom, dateTo]);

  async function fetchData() {
    setLoading(true);
    setSummary(null);
    setSelected({});
    try {
      const body = {
        action: "list_payments",
        date_from: dateFrom,
        date_to: dateTo,
        branch_code: isAdmin ? (filterBranch || "") : (userBranchCode || ""),
      };
      const res = await fetch(PAY_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  // applied filters (client-side)
  const filtered = rows.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterType && r.payment_type !== filterType) return false;
    if (isAdmin && filterBranch && r.branch_code !== filterBranch) return false;
    if (filterCreator && !(r.created_by || "").toLowerCase().includes(filterCreator.toLowerCase())) return false;
    return true;
  });

  // unique values for filter dropdowns
  const allBranches = [...new Set(rows.map(r => r.branch_code).filter(Boolean))].sort();
  const allCreators = [...new Set(rows.map(r => r.created_by).filter(Boolean))].sort();

  function toggleAll() {
    if (Object.keys(selected).length === filtered.length) {
      setSelected({});
    } else {
      const next = {};
      filtered.forEach(r => { next[r.charge_id] = true; });
      setSelected(next);
    }
  }

  function toggleOne(id) {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  }

  function handleSummarize() {
    const selectedRows = filtered.filter(r => selected[r.charge_id]);
    if (selectedRows.length === 0) {
      alert("กรุณาเลือกอย่างน้อย 1 รายการก่อน");
      return;
    }
    const total = selectedRows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const count = selectedRows.length;

    // group
    const groups = {};
    selectedRows.forEach(r => {
      let key, label;
      if (groupBy === "day") {
        const d = new Date(r.created_at);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
      } else if (groupBy === "month") {
        const d = new Date(r.created_at);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        label = `${monthNames[d.getMonth()]} ${d.getFullYear() + 543}`;
      } else if (groupBy === "branch") {
        key = r.branch_code || "(ไม่ระบุ)";
        label = r.branch_name ? `${r.branch_code} ${r.branch_name}` : (r.branch_code || "(ไม่ระบุ)");
      } else if (groupBy === "creator") {
        key = r.created_by || "(ไม่ระบุ)";
        label = key;
      } else if (groupBy === "type") {
        key = r.payment_type || "(ไม่ระบุ)";
        label = PAYMENT_TYPES.find(t => t.value === key)?.label || key;
      }
      if (!groups[key]) groups[key] = { key, label, total: 0, count: 0 };
      groups[key].total += Number(r.amount || 0);
      groups[key].count += 1;
    });
    const groupArr = Object.values(groups).sort((a, b) => b.total - a.total);
    setSummary({ total, count, groups: groupArr });
  }

  const allChecked = filtered.length > 0 && Object.keys(selected).length === filtered.length;
  const totalSelected = filtered.filter(r => selected[r.charge_id]).reduce((s, r) => s + Number(r.amount || 0), 0);
  const countSelected = Object.values(selected).filter(Boolean).length;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>วันที่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />

        <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 8 }}>สถานะ:</span>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
          <option value="">ทั้งหมด</option>
          <option value="paid">ชำระแล้ว</option>
          <option value="pending">รอชำระ</option>
          <option value="expired">หมดอายุ</option>
          <option value="cancelled">ยกเลิก</option>
        </select>

        <span style={{ fontSize: 12, fontWeight: 600 }}>ประเภท:</span>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inp}>
          <option value="">ทั้งหมด</option>
          {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {isAdmin && (
          <>
            <span style={{ fontSize: 12, fontWeight: 600 }}>สาขา:</span>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={inp}>
              <option value="">ทุกสาขา</option>
              {allBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </>
        )}

        <span style={{ fontSize: 12, fontWeight: 600 }}>ผู้บันทึก:</span>
        <select value={filterCreator} onChange={e => setFilterCreator(e.target.value)} style={inp}>
          <option value="">ทุกคน</option>
          {allCreators.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button onClick={fetchData} disabled={loading} style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {/* Group by + summarize button */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>📊 สรุปยอดแยกตาม:</span>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={inp}>
          <option value="day">รายวัน</option>
          <option value="month">รายเดือน</option>
          <option value="branch">สาขา</option>
          <option value="creator">ผู้บันทึก</option>
          <option value="type">ประเภท</option>
        </select>
        <button onClick={handleSummarize} style={{ padding: "8px 22px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          📊 สรุปยอดที่เลือก ({countSelected} รายการ · {fmt(totalSelected)} บาท)
        </button>
        {summary && (
          <button onClick={() => setSummary(null)} style={{ padding: "8px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            ✕ ปิดสรุป
          </button>
        )}
      </div>

      {/* Summary box */}
      {summary && (
        <div style={{ marginBottom: 10, padding: "14px 18px", background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", borderRadius: 10, border: "2px solid #059669" }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>รายการที่เลือก</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{summary.count}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>ยอดรวม</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{fmt(summary.total)} บาท</div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff", borderRadius: 6, overflow: "hidden" }}>
            <thead style={{ background: "#065f46", color: "#fff" }}>
              <tr>
                <th style={th}>{groupBy === "day" ? "วันที่" : groupBy === "month" ? "เดือน" : groupBy === "branch" ? "สาขา" : groupBy === "creator" ? "ผู้บันทึก" : "ประเภท"}</th>
                <th style={{ ...th, textAlign: "right" }}>รายการ</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                <th style={{ ...th, textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {summary.groups.map(g => (
                <tr key={g.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{g.label}</td>
                  <td style={{ ...td, textAlign: "right" }}>{g.count}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#059669" }}>{fmt(g.total)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#6b7280" }}>{summary.total > 0 ? ((g.total / summary.total) * 100).toFixed(1) : "0.0"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected info */}
      <div style={{ display: "flex", gap: 18, marginBottom: 10, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
        <span>📋 ทั้งหมด: <strong>{filtered.length}</strong> รายการ</span>
        <span>☑️ เลือก: <strong style={{ color: "#0369a1" }}>{countSelected}</strong> รายการ</span>
        <span>💰 ยอดที่เลือก: <strong style={{ color: "#059669" }}>{fmt(totalSelected)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: 40 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: "pointer", transform: "scale(1.2)" }} />
                </th>
                <th style={th}>วันที่/เวลา</th>
                <th style={th}>ประเภท</th>
                <th style={th}>อ้างอิง</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>สาขา</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวนเงิน</th>
                <th style={th}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr
                  key={r.charge_id}
                  style={{ borderTop: "1px solid #e5e7eb", background: selected[r.charge_id] ? "#eff6ff" : "transparent", cursor: "pointer" }}
                  onClick={() => toggleOne(r.charge_id)}
                >
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={!!selected[r.charge_id]}
                      onChange={() => toggleOne(r.charge_id)}
                      onClick={e => e.stopPropagation()}
                      style={{ cursor: "pointer", transform: "scale(1.2)" }}
                    />
                  </td>
                  <td style={td}>{fmtDateTime(r.created_at)}</td>
                  <td style={td}>{PAYMENT_TYPES.find(t => t.value === r.payment_type)?.label || r.payment_type || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.ref_no || "-"}</td>
                  <td style={td}>{r.customer_name || "-"}</td>
                  <td style={{ ...td, fontSize: 11 }}>
                    {r.branch_code && <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.branch_code}</span>}
                    {r.branch_code && r.branch_name && " "}
                    {r.branch_name && <span>{r.branch_name}</span>}
                  </td>
                  <td style={{ ...td, fontSize: 11 }}>{r.created_by || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: r.status === "paid" ? "#059669" : "#6b7280" }}>{fmt(r.amount)}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: STATUS_LABEL[r.status]?.color, background: STATUS_LABEL[r.status]?.bg }}>
                      {STATUS_LABEL[r.status]?.text || r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inp = { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const inp2 = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 };
const td = { padding: "8px 12px", fontSize: 12, color: "#1f2937" };
