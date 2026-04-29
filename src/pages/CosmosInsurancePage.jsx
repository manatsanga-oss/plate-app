import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

const PLAN_OPTS = [
  { key: "rsa",           label: "RSA (ช่วยเหลือฉุกเฉิน)",     table: "cosmos_rsa",   color: "#1565c0" },
  { key: "pa",            label: "PA (อุบัติเหตุส่วนบุคคล)",    table: "cosmos_pa",    color: "#2e7d32" },
  { key: "3plus",         label: "3 PLUS",                       table: "cosmos_3plus", color: "#7b1fa2" },
  { key: "theft",         label: "ประกันรถหาย",                table: "cosmos_theft", color: "#c62828" },
  { key: "theft_renewal", label: "ประกันรถหายปีต่อ",          table: "cosmos_theft", color: "#ea580c" },
];

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

function fmtMoney(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ตัด "0 " หรือ "0  " ที่นำหน้า chassis_no
function cleanChassis(v) {
  if (!v) return "";
  return String(v).replace(/^0\s+/, "").trim();
}

export default function CosmosInsurancePage({ currentUser }) {
  const [mode, setMode] = useState("save"); // save | history
  const [message, setMessage] = useState("");

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🛡️ บันทึกประกัน COSMOS</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["save",    "📝 บันทึก"],
          ["history", "📋 ประวัติการบันทึก"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => { setMode(v); setMessage(""); }}
            style={{
              padding: "10px 20px", border: "none", background: "transparent",
              cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: mode === v ? "#072d6b" : "#6b7280",
              borderBottom: mode === v ? "3px solid #072d6b" : "3px solid transparent",
              marginBottom: -2,
            }}>{label}</button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : message.startsWith("⚠️") ? "#fef3c7" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : message.startsWith("⚠️") ? "#92400e" : "#991b1b",
          fontSize: 14 }}>
          {message}
        </div>
      )}

      {mode === "save"
        ? <HistoryPanel setMessage={setMessage} currentUser={currentUser} />
        : <SubmissionsPanel setMessage={setMessage} />}
    </div>
  );
}

/* ============================================================================
   TAB: ประวัติการบันทึก (group by batch_no)
   ============================================================================ */
function SubmissionsPanel({ setMessage }) {
  const [plan, setPlan] = useState("rsa");
  const [batches, setBatches] = useState([]);
  const [details, setDetails] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const currentPlan = PLAN_OPTS.find(p => p.key === plan) || PLAN_OPTS[0];

  useEffect(() => { fetchBatches(plan); /* eslint-disable-next-line */ }, [plan]);

  async function fetchBatches(planKey) {
    setLoading(true); setMessage(""); setSelectedBatch(null); setDetails([]);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_submissions", plan: planKey }),
      });
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch {
      setMessage("❌ โหลดไม่สำเร็จ");
      setBatches([]);
    }
    setLoading(false);
  }

  async function viewBatch(batch_no) {
    setLoading(true); setSelectedBatch(batch_no); setDetails([]);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_submissions", batch_no }),
      });
      const data = await res.json();
      setDetails(Array.isArray(data) ? data : []);
    } catch {
      setMessage("❌ โหลดรายละเอียดไม่สำเร็จ");
    }
    setLoading(false);
  }

  return (
    <div>
      {/* Combobox + Refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>ประเภทประกัน:</label>
        <select value={plan} onChange={e => setPlan(e.target.value)}
          style={{
            padding: "7px 12px", fontSize: 13, fontWeight: 600, borderRadius: 6,
            border: `2px solid ${currentPlan.color}`, background: "#fff",
            color: currentPlan.color, cursor: "pointer", minWidth: 240, outline: "none",
            fontFamily: "Tahoma",
          }}>
          {PLAN_OPTS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <button onClick={() => fetchBatches(plan)} disabled={loading}
          style={{ padding: "7px 16px", background: currentPlan.color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {/* List of batches */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 12 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 13 }}>
          📦 รายการ Batch — {batches.length} ใบ
        </div>
        {loading && !selectedBatch ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : batches.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีบันทึก</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f3f4f6" }}>
              <tr>
                <th style={th}>เลขที่ใบบันทึก</th>
                <th style={th}>ประเภท</th>
                <th style={th}>จำนวน</th>
                <th style={th}>เบี้ยรวม</th>
                <th style={th}>วันที่บันทึก</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}>ดู</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b, i) => (
                <tr key={b.batch_no} style={{ borderTop: "1px solid #e5e7eb", background: selectedBatch === b.batch_no ? "#eff6ff" : "transparent" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: currentPlan.color }}>{b.batch_no}</td>
                  <td style={td}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af" }}>{b.plan}</span></td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{b.items}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{Number(b.total_premium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={td}>{new Date(b.submitted_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td style={td}>{b.submitted_by || "-"}</td>
                  <td style={td}>
                    <button onClick={() => viewBatch(b.batch_no)}
                      style={{ padding: "3px 10px", background: currentPlan.color, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                      📂 ดู
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Details of selected batch */}
      {selectedBatch && (
        <div style={{ background: "#fff", borderRadius: 10, border: "2px solid " + currentPlan.color }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 13, background: currentPlan.color, color: "#fff", borderRadius: "8px 8px 0 0" }}>
            📂 รายละเอียด Batch: <code style={{ background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 4 }}>{selectedBatch}</code>
            <button onClick={() => { setSelectedBatch(null); setDetails([]); }}
              style={{ float: "right", padding: "2px 10px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>✕ ปิด</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
          ) : details.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f3f4f6" }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>App No.</th>
                    <th style={th}>Invoice</th>
                    <th style={th}>ลูกค้า</th>
                    <th style={th}>เลขถัง</th>
                    <th style={th}>แผน</th>
                    <th style={th}>เบี้ย</th>
                    <th style={th}>คุ้มครอง</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, i) => (
                    <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{d.app_no}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: "#059669" }}>{d.invoice_no || "-"}</td>
                      <td style={td}>{d.customer_name || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{cleanChassis(d.chassis_no) || "-"}</td>
                      <td style={td}>{d.plan_name || "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtMoney(d.premium)}</td>
                      <td style={{ ...td, fontSize: 11 }}>{fmtDate(d.cover_start)} - {fmtDate(d.cover_end)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TAB: บันทึก (Placeholder ไว้สำหรับ form กรอกข้อมูล/OCR ในอนาคต)
   ปัจจุบัน — ข้อมูลมาจาก Upload xlsx ที่หน้า Upload
   ============================================================================ */
function SavePanel({ setMessage, currentUser }) {
  const [plan, setPlan] = useState("rsa");
  const currentPlan = PLAN_OPTS.find(p => p.key === plan) || PLAN_OPTS[0];

  return (
    <div>
      {/* Combobox เลือกประเภทประกัน */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "14px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>ประเภทประกัน:</label>
        <select value={plan} onChange={e => setPlan(e.target.value)}
          style={{
            padding: "8px 14px", fontSize: 14, fontWeight: 600, borderRadius: 6,
            border: `2px solid ${currentPlan.color}`, background: "#fff",
            color: currentPlan.color, cursor: "pointer", minWidth: 280, outline: "none",
            fontFamily: "Tahoma",
          }}>
          {PLAN_OPTS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280" }}>
          → Table: <code style={{ color: currentPlan.color, fontWeight: 600 }}>{currentPlan.table}</code>
        </span>
      </div>

      <div style={{ padding: 32, textAlign: "center", background: "#fff", border: "1px dashed #d1d5db", borderRadius: 10, color: "#6b7280" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>ขณะนี้ใช้การนำเข้าผ่านไฟล์ Excel</div>
        <div style={{ fontSize: 13 }}>
          ไปที่หน้า <strong>Upload เข้าฐานข้อมูล</strong> → กลุ่ม <strong>"อื่นๆ"</strong> → กดปุ่ม <strong>"ประกัน COSMOS"</strong>
        </div>
        <div style={{ fontSize: 12, marginTop: 10, color: "#9ca3af" }}>
          (ระบบจะดึงไฟล์ทุกเดือนจาก OneDrive folder อัตโนมัติ)
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   TAB: ประวัติการบันทึก
   ============================================================================ */
function HistoryPanel({ setMessage, currentUser }) {
  const [plan, setPlan] = useState("rsa");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set()); // app_no ที่ถูกเลือก
  const currentPlan = PLAN_OPTS.find(p => p.key === plan) || PLAN_OPTS[0];

  // Manual sale link selector
  const [linkRow, setLinkRow] = useState(null); // current cosmos row being matched
  const [searchKw, setSearchKw] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  function openLinkSelector(r) {
    setLinkRow(r);
    setSearchKw(r.chassis_no || "");
    setSearchResults([]);
    setTimeout(() => doSearch(r.chassis_no || ""), 50);
  }

  async function doSearch(kw) {
    setSearchLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_moto_sales", keyword: kw }),
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }

  async function saveSubmission() {
    // เฉพาะ row ที่ติ๊กเลือก + จับคู่กับการขายแล้ว
    const rowsToSave = filtered.filter(r => selected.has(r.app_no) && r.sale_id);
    if (!rowsToSave.length) {
      setMessage("⚠️ กรุณาติ๊กเลือกรายการที่ต้องการบันทึก (เฉพาะที่จับคู่กับการขายแล้วเท่านั้น)");
      return;
    }
    if (!window.confirm(`บันทึก ${rowsToSave.length} รายการ ${currentPlan.label} ลงฐานข้อมูล?`)) return;

    setLoading(true);
    setMessage("");
    try {
      const payload = {
        action: "save_cosmos_submission",
        plan,
        submitted_by: currentUser?.username || currentUser?.name || "system",
        rows: rowsToSave.map(r => ({
          app_no: r.app_no,
          invoice_no: r.invoice_no,
          customer_name: r.sale_customer_name || r.customer_name || "",
          chassis_no: cleanChassis(r.chassis_no),
          plan_name: r.plan_name,
          premium: r.premium,
          cover_start: r.cover_start,
          cover_end: r.cover_end,
        })),
      };
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.success) {
        const batches = (data.batches || []).filter(Boolean);
        setMessage(`✅ บันทึก ${data.count} รายการ — Batch: ${batches.join(", ") || "-"}`);
        setSelected(new Set()); // เคลียร์การเลือก
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ");
      }
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + e.message);
    }
    setLoading(false);
  }

  async function pickSale(sale) {
    if (!linkRow) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_cosmos_sale",
          plan, app_no: linkRow.app_no, sale_id: sale.id, chassis_no: sale.chassis_no,
        }),
      });
      setMessage(`✅ ลิงก์ ${linkRow.app_no} → ${sale.invoice_no} แล้ว`);
      setLinkRow(null);
      fetchData(plan);
    } catch {
      setMessage("❌ ลิงก์ไม่สำเร็จ");
    }
  }

  useEffect(() => { fetchData(plan); /* eslint-disable-next-line */ }, [plan]);
  useEffect(() => { setSelected(new Set()); }, [plan]); // เปลี่ยนแผน → reset selection

  function toggleRow(appNo) {
    setSelected(s => {
      const ns = new Set(s);
      if (ns.has(appNo)) ns.delete(appNo); else ns.add(appNo);
      return ns;
    });
  }

  function toggleAll(rows) {
    setSelected(s => {
      const eligible = rows.filter(r => r.sale_id).map(r => r.app_no);
      const allSelected = eligible.every(a => s.has(a));
      if (allSelected) return new Set();
      return new Set(eligible);
    });
  }

  async function fetchData(planKey) {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_insurance", plan: planKey }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setMessage("❌ โหลดไม่สำเร็จ");
      setRows([]);
    }
    setLoading(false);
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.app_no, r.customer_name, r.chassis_no, r.plan_name, r.brand, r.model_name, r.citizen_id, r.phone]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalPremium = filtered.reduce((s, r) => s + (Number(r.premium) || 0), 0);
  const isPlus = plan === "3plus";
  const isPA = plan === "pa";
  const isRSA = plan === "rsa";
  const isTheft = plan === "theft" || plan === "theft_renewal";
  const hideReceipt = isPA || isRSA;

  return (
    <div>
      {/* Combobox + Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>ประเภทประกัน:</label>
        <select value={plan} onChange={e => setPlan(e.target.value)}
          style={{
            padding: "7px 12px", fontSize: 13, fontWeight: 600, borderRadius: 6,
            border: `2px solid ${currentPlan.color}`, background: "#fff",
            color: currentPlan.color, cursor: "pointer", minWidth: 240, outline: "none",
            fontFamily: "Tahoma",
          }}>
          {PLAN_OPTS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <input type="text" placeholder="🔍 ค้นหา (app_no, ลูกค้า, เลขถัง, รุ่น, เลขบัตร)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 240 }} />

        <button onClick={() => fetchData(plan)} disabled={loading}
          style={{ padding: "7px 16px", background: currentPlan.color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
        <button onClick={saveSubmission} disabled={loading || selected.size === 0}
          style={{ padding: "7px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: selected.size ? "pointer" : "not-allowed", fontWeight: 600, opacity: selected.size ? 1 : 0.5 }}>
          💾 บันทึก ({selected.size})
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>📋 รายการรวม: <strong>{filtered.length}</strong></span>
        {!isPlus && <span style={{ fontSize: 13, color: currentPlan.color }}>💰 เบี้ยรวม: <strong>{fmtMoney(totalPremium)}</strong> บาท</span>}
        <span style={{ fontSize: 13, color: "#059669" }}>🚗 จับคู่ขาย: <strong>{filtered.filter(r => r.sale_id).length}</strong></span>
        {!hideReceipt && <span style={{ fontSize: 13, color: "#0369a1" }}>📋 จับคู่รับเรื่อง: <strong>{filtered.filter(r => r.receipt_no).length}</strong></span>}
        <span style={{ fontSize: 13, color: "#7c3aed", fontWeight: 700 }}>☑️ เลือกแล้ว: {selected.size}</span>
        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>Table: <code>{currentPlan.table}</code></span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: currentPlan.color, color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: 36, textAlign: "center" }}>
                  <input type="checkbox"
                    checked={filtered.filter(r => r.sale_id).length > 0 && filtered.filter(r => r.sale_id).every(r => selected.has(r.app_no))}
                    onChange={() => toggleAll(filtered)}
                    style={{ cursor: "pointer", width: 16, height: 16 }} />
                </th>
                <th style={th}>#</th>
                <th style={th}>App No.</th>
                {isPA ? (
                  <>
                    <th style={th}>ชื่อลูกค้า</th>
                    <th style={th}>แผน</th>
                    <th style={th}>เบี้ย</th>
                    <th style={th}>เลขถัง (VIN)</th>
                    <th style={th}>🚗 ขาย</th>
                  </>
                ) : (
                  <>
                    <th style={th}>วันที่สมัคร</th>
                    <th style={th}>ชื่อลูกค้า</th>
                    <th style={th}>เลขถัง (VIN)</th>
                    {!isPlus && <>
                      <th style={th}>เลขบัตร</th>
                      <th style={th}>เบอร์โทร</th>
                      <th style={th}>ยี่ห้อ/รุ่น</th>
                      <th style={th}>สี</th>
                    </>}
                    {isPlus && <th style={th}>รุ่นรถ</th>}
                    {!isTheft && <th style={th}>แผน</th>}
                    {!isPlus && <>
                      <th style={th}>เริ่มคุ้มครอง</th>
                      <th style={th}>สิ้นสุด</th>
                      <th style={th}>เบี้ย</th>
                    </>}
                    <th style={th}>🚗 ขาย</th>
                    {!hideReceipt && <th style={th}>📋 รับเรื่อง</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.app_no + i} style={{ borderTop: "1px solid #e5e7eb", background: selected.has(r.app_no) ? "#fef3c7" : "transparent" }}>
                  <td style={{ ...td, textAlign: "center" }}>
                    <input type="checkbox"
                      checked={selected.has(r.app_no)}
                      onChange={() => toggleRow(r.app_no)}
                      disabled={!r.sale_id}
                      title={!r.sale_id ? "ต้องเลือกใบขายก่อน" : ""}
                      style={{ cursor: r.sale_id ? "pointer" : "not-allowed", width: 16, height: 16 }} />
                  </td>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: currentPlan.color }}>{r.app_no}</td>
                  {isPA ? (
                    <>
                      <td style={{ ...td, fontWeight: 500 }}>{r.sale_customer_name || r.customer_name || "-"}</td>
                      <td style={td}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af" }}>
                          {r.plan_name || "-"}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtMoney(r.premium)}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{cleanChassis(r.chassis_no) || "-"}</td>
                      <td style={td}>
                        {r.sale_id ? (
                          <span title={`Invoice: ${r.invoice_no || "-"} | ${fmtDate(r.sale_date)}`}
                                style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
                            ✓ {r.invoice_no || "ขายแล้ว"}
                          </span>
                        ) : (
                          <button onClick={() => openLinkSelector(r)}
                            style={{ padding: "3px 10px", background: "#fff", color: currentPlan.color, border: `1px solid ${currentPlan.color}`, borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            🔍 เลือกใบขาย
                          </button>
                        )}
                      </td>
                      {!hideReceipt && (
                        <td style={td}>
                          {r.receipt_no ? (
                            <span title={`Receipt: ${r.receipt_no} | ${fmtDate(r.receive_date)}`}
                                  style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>
                              ✓ {r.receipt_no}
                            </span>
                          ) : <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>}
                        </td>
                      )}
                    </>
                  ) : (
                    <>
                      <td style={td}>{fmtDate(r.app_date)}</td>
                      <td style={{ ...td, fontWeight: 500 }}>{(isTheft ? r.sale_customer_name : r.customer_name) || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{cleanChassis(r.chassis_no) || "-"}</td>
                      {!isPlus && <>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.citizen_id || "-"}</td>
                        <td style={{ ...td, fontSize: 11 }}>{r.phone || "-"}</td>
                        <td style={td}>
                          <div style={{ fontSize: 12 }}>{r.brand || ""} {r.model_name || ""}</div>
                        </td>
                        <td style={{ ...td, fontSize: 11 }}>{r.color || "-"}</td>
                      </>}
                      {isPlus && <td style={td}>{r.model_name || "-"}</td>}
                      {!isTheft && (
                        <td style={td}>
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af" }}>
                            {r.plan_name || "-"}
                          </span>
                        </td>
                      )}
                      {!isPlus && <>
                        <td style={td}>{fmtDate(r.cover_start)}</td>
                        <td style={td}>{fmtDate(r.cover_end)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtMoney(r.premium)}</td>
                      </>}
                      <td style={td}>
                        {r.sale_id ? (
                          <span title={`Invoice: ${r.invoice_no || "-"} | ${fmtDate(r.sale_date)}`}
                                style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
                            ✓ {r.invoice_no || "ขายแล้ว"}
                          </span>
                        ) : (
                          <button onClick={() => openLinkSelector(r)}
                            style={{ padding: "3px 10px", background: "#fff", color: currentPlan.color, border: `1px solid ${currentPlan.color}`, borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            🔍 เลือกใบขาย
                          </button>
                        )}
                      </td>
                      {!hideReceipt && (
                        <td style={td}>
                          {r.receipt_no ? (
                            <span title={`Receipt: ${r.receipt_no} | ${fmtDate(r.receive_date)} | ${r.receipt_branch_name || "-"}`}
                                  style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>
                              ✓ {r.receipt_no}
                            </span>
                          ) : <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>}
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: ค้นหาและเลือกใบขาย */}
      {linkRow && (
        <div onClick={() => setLinkRow(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 12, padding: 20, width: "90%", maxWidth: 800,
            maxHeight: "85vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: currentPlan.color }}>
                🔍 เลือกใบขายสำหรับ <code style={{ color: "#374151" }}>{linkRow.app_no}</code>
              </h3>
              <button onClick={() => setLinkRow(null)} style={{ padding: "4px 10px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder="ค้นหา (เลขถัง, invoice, ชื่อลูกค้า)"
                value={searchKw} onChange={e => setSearchKw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch(searchKw)}
                autoFocus
                style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "Tahoma" }} />
              <button onClick={() => doSearch(searchKw)} disabled={searchLoading}
                style={{ padding: "8px 16px", background: currentPlan.color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                {searchLoading ? "..." : "ค้นหา"}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              {searchLoading ? (
                <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังค้นหา...</div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีผลลัพธ์</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={th}>Invoice</th>
                      <th style={th}>วันที่ขาย</th>
                      <th style={th}>ลูกค้า</th>
                      <th style={th}>เลขถัง</th>
                      <th style={th}>รุ่น</th>
                      <th style={th}>เลือก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((s, i) => (
                      <tr key={s.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{s.invoice_no}</td>
                        <td style={td}>{fmtDate(s.sale_date)}</td>
                        <td style={td}>{s.customer_name}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{s.chassis_no}</td>
                        <td style={td}>{s.brand} {s.model_series}</td>
                        <td style={td}>
                          <button onClick={() => pickSale(s)}
                            style={{ padding: "4px 12px", background: currentPlan.color, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            ✓ เลือก
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp ={ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
