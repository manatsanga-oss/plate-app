import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const MASTER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

export default function RegistrationSubmitReceiptPage({ currentUser }) {
  const [tab, setTab] = useState("pending");  // 'pending' | 'history'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // history state
  const [historyBatches, setHistoryBatches] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState({});
  const [branchFilter, setBranchFilter] = useState("");
  const [incomeTypeFilter, setIncomeTypeFilter] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState({});  // {receipt_no: true/false}
  const [expandAll, setExpandAll] = useState(true);
  const [selected, setSelected] = useState({});  // {line_id: true/false}
  const [selectedLineData, setSelectedLineData] = useState({});  // {line_id: lineObj} — เก็บ object เต็มของรายการที่เลือก เพื่อจดจำข้ามการค้นหา
  const [submitDialog, setSubmitDialog] = useState(false);
  const [destination, setDestination] = useState("");
  const [submissionDate, setSubmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitNote, setSubmitNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_receipt_lines",
          date_from: dateFrom, date_to: dateTo,
          branch_code: branchFilter, income_type: incomeTypeFilter,
          keyword: search.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      setRows(arr);
      if (arr.length === 0) setMessage("");
    } catch (e) {
      setRows([]);
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_submission_batches",
          date_from: historyDateFrom, date_to: historyDateTo,
          status: historyStatus, keyword: historySearch.trim(),
        }),
      });
      const data = await res.json();
      setHistoryBatches(Array.isArray(data) ? data : []);
    } catch { setHistoryBatches([]); }
    setHistoryLoading(false);
  }

  async function cancelBatch(batch) {
    const reason = window.prompt(`ยกเลิก batch ${batch.batch_code}?\n\nกรุณาระบุเหตุผล:`);
    if (reason === null) return;
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_submission_batch",
          batch_id: batch.batch_id,
          cancel_reason: reason || "",
          cancelled_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      if (data?.error_msg) throw new Error(data.error_msg);
      setMessage(`✅ ยกเลิก ${batch.batch_code} แล้ว — ปล่อยรายการ ${data?.released_items || 0} รายการกลับเป็น pending`);
      fetchHistory();
      fetchData();
    } catch (e) {
      setMessage("❌ ยกเลิกไม่สำเร็จ: " + String(e.message || e).slice(0, 200));
    }
  }

  function reprintCoverSheet(batch) {
    printCoverSheet({
      batch_code: batch.batch_code,
      submission_date: batch.submission_date,
      destination: batch.destination,
      note: batch.note,
      created_by: batch.created_by,
      items: (batch.items || []).map(i => ({ ...i, receive_date: null })),
    });
  }

  function toggleHistory(id) {
    setHistoryExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function fmtNum(v) {
    const n = Number(v || 0);
    return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }
  function fmtBranch(c) {
    if (!c) return "-";
    return /^0+$/.test(String(c).trim()) ? "SCY01" : String(c).trim();
  }

  // Group rows by receipt_no
  const grouped = {};
  rows.forEach(r => {
    if (!r.receipt_no) return;
    if (!grouped[r.receipt_no]) {
      grouped[r.receipt_no] = {
        receipt_no: r.receipt_no,
        receive_date: r.receive_date,
        receive_status: r.receive_status,
        receipt_type: r.receipt_type,
        branch_code: r.branch_code,
        branch_name: r.branch_name,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_id_card: r.customer_id_card,
        staff_recorder: r.staff_recorder,
        contract_no: r.contract_no,
        brand: r.brand,
        model_series: r.model_series,
        model_code: r.model_code,
        color: r.color,
        engine_no: r.engine_no,
        chassis_no: r.chassis_no,
        plate_number: r.plate_number,
        receipt_total: r.receipt_total,
        lines: [],
      };
    }
    grouped[r.receipt_no].lines.push(r);
  });
  const receipts = Object.values(grouped).sort((a, b) => {
    const da = a.receive_date ? new Date(a.receive_date).getTime() : 0;
    const db = b.receive_date ? new Date(b.receive_date).getTime() : 0;
    return db - da;
  });

  // collect filter options from data
  const branchOpts = [...new Set(rows.map(r => fmtBranch(r.branch_code)).filter(v => v && v !== "-"))].sort();
  const incomeTypeOpts = [...new Set(rows.map(r => r.income_type).filter(Boolean))].sort();

  // summary
  const totalNet = rows.reduce((s, r) => s + Number(r.net_price || 0), 0);
  const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
  const uniqueReceipts = receipts.length;

  function toggleAll() {
    const next = !expandAll;
    setExpandAll(next);
    const newExpanded = {};
    receipts.forEach(r => { newExpanded[r.receipt_no] = next; });
    setExpanded(newExpanded);
  }
  function toggleOne(no) {
    setExpanded(prev => ({ ...prev, [no]: !(no in prev ? prev[no] : expandAll) }));
  }
  function isOpen(no) {
    return no in expanded ? expanded[no] : expandAll;
  }

  function toggleLineSelect(line) {
    const lineId = line.line_id;
    const isOn = !selected[lineId];
    setSelected(prev => ({ ...prev, [lineId]: isOn }));
    setSelectedLineData(prev => {
      const next = { ...prev };
      if (isOn) next[lineId] = line;
      else delete next[lineId];
      return next;
    });
  }
  function toggleSelectAllLines() {
    const allSelected = rows.length > 0 && rows.every(r => selected[r.line_id]);
    if (allSelected) {
      // ยกเลิกเลือกเฉพาะ rows ปัจจุบัน — ไม่กระทบรายการที่เลือกไว้นอก search
      setSelected(prev => {
        const next = { ...prev };
        rows.forEach(r => { delete next[r.line_id]; });
        return next;
      });
      setSelectedLineData(prev => {
        const next = { ...prev };
        rows.forEach(r => { delete next[r.line_id]; });
        return next;
      });
    } else {
      setSelected(prev => {
        const next = { ...prev };
        rows.forEach(r => { next[r.line_id] = true; });
        return next;
      });
      setSelectedLineData(prev => {
        const next = { ...prev };
        rows.forEach(r => { next[r.line_id] = r; });
        return next;
      });
    }
  }
  function toggleReceiptLines(rcpt, on) {
    setSelected(prev => {
      const next = { ...prev };
      rcpt.lines.forEach(l => { next[l.line_id] = on; });
      return next;
    });
    setSelectedLineData(prev => {
      const next = { ...prev };
      rcpt.lines.forEach(l => {
        if (on) next[l.line_id] = l;
        else delete next[l.line_id];
      });
      return next;
    });
  }
  function clearAllSelected() {
    setSelected({});
    setSelectedLineData({});
  }

  // selectedLines: ใช้ข้อมูลจาก selectedLineData (เก็บข้ามการค้นหา) ไม่ใช่ rows ปัจจุบัน
  const selectedLines = Object.values(selectedLineData);
  const selCount = selectedLines.length;
  const selTotal = selectedLines.reduce((s, l) => s + Number(l.net_price || 0), 0);
  const selReceipts = [...new Set(selectedLines.map(l => l.receipt_no))];
  // จำนวนรายการที่เลือกไว้แต่ไม่อยู่ในผลค้นหาปัจจุบัน
  const selectedNotInRows = selectedLines.filter(l => !rows.some(r => r.line_id === l.line_id));

  async function fetchSuppliers() {
    try {
      const res = await fetch(MASTER_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }),
      });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
      setSuppliersLoaded(true);
    } catch {
      setSuppliers([]);
      setSuppliersLoaded(true);
    }
  }

  function openSubmitDialog() {
    if (selCount === 0) { setMessage("❌ เลือกรายการก่อน"); return; }
    setDestination("");
    setSubmitNote("");
    setSubmissionDate(new Date().toISOString().slice(0, 10));
    setSubmitDialog(true);
    if (!suppliersLoaded) fetchSuppliers();
  }

  async function doSubmit() {
    if (!destination.trim()) { setMessage("❌ กรุณาระบุปลายทาง"); return; }
    if (selCount === 0) return;
    setSubmitting(true);
    setMessage("");
    try {
      const lineIds = selectedLines.map(l => l.line_id);
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_receipt_lines",
          line_ids: lineIds,
          destination: destination.trim(),
          note: submitNote.trim(),
          submission_date: submissionDate,
          created_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error_msg) throw new Error(data?.error_msg || `HTTP ${res.status}`);
      const batchCode = data?.batch_code || "";
      const itemsCount = data?.items_count || 0;
      // Print cover sheet
      printCoverSheet({
        batch_code: batchCode,
        submission_date: submissionDate,
        destination: destination.trim(),
        note: submitNote.trim(),
        created_by: currentUser?.username || currentUser?.name || "",
        items: selectedLines,
      });
      setMessage(`✅ ส่งเรื่องสำเร็จ — ${batchCode} (${itemsCount} รายการ)`);
      setSubmitDialog(false);
      clearAllSelected();
      fetchData();
    } catch (e) {
      setMessage("❌ ส่งเรื่องไม่สำเร็จ: " + String(e.message || e).slice(0, 200));
    }
    setSubmitting(false);
  }

  function printCoverSheet(batch) {
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) { setMessage("popup blocked — กรุณาเปิด popup"); return; }
    w.document.write(buildCoverSheetHTML(batch, fmtNum, fmtDate, fmtBranch));
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📤 ส่งงานทะเบียนรับเรื่อง</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["pending", "📋 รอส่ง"],
          ["history", "📚 ส่งแล้ว / ประวัติ"],
        ].map(([v, label]) => (
          <button key={v}
            onClick={() => { setTab(v); if (v === "history" && historyBatches.length === 0) fetchHistory(); }}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {tab === "pending" && (<>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่รับเรื่อง:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />

        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={inputStyle}>
          <option value="">ทุกสาขา</option>
          {branchOpts.map(b => <option key={b} value={b === "SCY01" ? "00000" : b}>{b}</option>)}
        </select>

        <select value={incomeTypeFilter} onChange={e => setIncomeTypeFilter(e.target.value)} style={inputStyle}>
          <option value="">ทุกประเภทรายได้</option>
          {incomeTypeOpts.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <input type="text" placeholder="🔍 ค้นหา (ลูกค้า, เลขถัง, ทะเบียน, ชื่อรายได้, รายละเอียด)"
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchData()}
          style={{ ...inputStyle, flex: 1, minWidth: 260 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔍 ค้นหา"}
        </button>

        <button onClick={toggleAll}
          style={{ padding: "7px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {expandAll ? "▾ ย่อทั้งหมด" : "▸ ขยายทั้งหมด"}
        </button>
      </div>

      {/* Summary + selection action */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={rows.length > 0 && rows.every(r => selected[r.line_id])}
            onChange={toggleSelectAllLines} style={{ width: 16, height: 16 }} />
          เลือกรายการทั้งหมด
        </label>
        <span style={{ fontSize: 13, color: "#6b7280" }}>|</span>
        <span style={{ fontSize: 13 }}>🧾 ใบรับเรื่อง: <strong>{uniqueReceipts}</strong></span>
        <span style={{ fontSize: 13 }}>📋 รายการรวม: <strong>{rows.length}</strong></span>
        <span style={{ fontSize: 13 }}>จำนวนรวม: <strong>{fmtNum(totalQty)}</strong></span>
        <span style={{ fontSize: 13 }}>ยอดสุทธิรวม: <strong style={{ color: "#dc2626" }}>{fmtNum(totalNet)}</strong> บาท</span>
        <div style={{ flex: 1 }} />
        {selCount > 0 && (
          <span style={{ fontSize: 13, padding: "4px 10px", background: "#fef9c3", borderRadius: 6, fontWeight: 600 }}>
            ✓ เลือก {selCount} รายการ · ฿ {fmtNum(selTotal)}
          </span>
        )}
        {selCount > 0 && (
          <button onClick={clearAllSelected} title="ล้างทุกรายการที่เลือกไว้"
            style={{ padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            ✕ ล้างเลือก
          </button>
        )}
        <button onClick={openSubmitDialog} disabled={selCount === 0}
          style={{ padding: "8px 18px", background: selCount === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: selCount === 0 ? "not-allowed" : "pointer", fontWeight: 700 }}>
          📤 ส่งเรื่องงานทะเบียน
        </button>
      </div>

      {selectedNotInRows.length > 0 && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, fontSize: 13, color: "#1e40af", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>📌 จดจำการเลือกไว้ <strong>{selectedNotInRows.length}</strong> รายการ จากการค้นหาก่อนหน้า (ไม่อยู่ในผลค้นหาปัจจุบัน) — ยอดรวม ฿ {fmtNum(selectedNotInRows.reduce((s, l) => s + Number(l.net_price || 0), 0))}</span>
          <span style={{ fontSize: 11, opacity: 0.75 }}>ใบรับเรื่อง: {[...new Set(selectedNotInRows.map(l => l.receipt_no))].join(", ")}</span>
        </div>
      )}

      {/* Receipts grouped */}
      {loading ? (
        <div style={{ padding: 30, textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: 10 }}>กำลังโหลด...</div>
      ) : receipts.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10 }}>ไม่มีข้อมูล</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {receipts.map(rcpt => {
            const open = isOpen(rcpt.receipt_no);
            const lineSum = rcpt.lines.reduce((s, l) => s + Number(l.net_price || 0), 0);
            const rcptAllSel = rcpt.lines.length > 0 && rcpt.lines.every(l => selected[l.line_id]);
            const rcptSomeSel = rcpt.lines.some(l => selected[l.line_id]);
            return (
              <div key={rcpt.receipt_no} style={{ background: "#fff", borderRadius: 10, border: rcptSomeSel ? "2px solid #059669" : "1px solid #e5e7eb", overflow: "hidden", transition: "border-color 0.15s" }}>
                {/* HEADER */}
                <div onClick={() => toggleOne(rcpt.receipt_no)}
                  style={{ padding: "10px 14px", background: "linear-gradient(90deg,#072d6b 0%,#0e4ba8 100%)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 14 }}>{open ? "▾" : "▸"}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto auto auto", gap: 14, flex: 1, alignItems: "center", fontSize: 13 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{rcpt.receipt_no}</span>
                    <span style={{ background: "#fff3", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{fmtDate(rcpt.receive_date)}</span>
                    <span><strong>{rcpt.customer_name || "-"}</strong> · {rcpt.brand} {rcpt.model_series} · ตัวถัง {rcpt.chassis_no || "-"}</span>
                    <span style={{ background: "#fff2", padding: "2px 10px", borderRadius: 4, fontSize: 11 }}>{fmtBranch(rcpt.branch_code)}</span>
                    <span style={{ fontWeight: 700 }}>฿ {fmtNum(rcpt.receipt_total || lineSum)}</span>
                    <span style={{ fontSize: 11, opacity: 0.85 }}>
                      {rcptSomeSel ? `✓ ${rcpt.lines.filter(l => selected[l.line_id]).length}/${rcpt.lines.length}` : ""}
                    </span>
                  </div>
                </div>

                {/* HEADER detail strip + LINES */}
                {open && (
                  <>
                    <div style={{ padding: "8px 14px", background: "#f8fafc", borderTop: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 11 }}>
                      <KV label="ประเภท" value={rcpt.receipt_type} />
                      <KV label="สถานะ" value={rcpt.receive_status} />
                      <KV label="พนักงาน" value={rcpt.staff_recorder} />
                      <KV label="สัญญาเช่าซื้อ" value={rcpt.contract_no} />
                      <KV label="เลขทะเบียน" value={rcpt.plate_number} />
                      <KV label="เลขเครื่อง" value={rcpt.engine_no} mono />
                      <KV label="สี" value={rcpt.color} />
                      <KV label="โทร" value={rcpt.customer_phone} />
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead style={{ background: "#f3f4f6" }}>
                        <tr>
                          <th style={th}>#</th>
                          <th style={th}>ประเภทรายได้</th>
                          <th style={th}>รหัส</th>
                          <th style={th}>ชื่อรายได้</th>
                          <th style={th}>รายละเอียด</th>
                          <th style={th}>จำนวน</th>
                          <th style={th}>ราคา</th>
                          <th style={th}>ส่วนลด</th>
                          <th style={th}>สุทธิ</th>
                          <th style={{ ...th, textAlign: "center" }}>
                            <input type="checkbox" checked={rcptAllSel} onChange={() => toggleReceiptLines(rcpt, !rcptAllSel)} title="เลือก/ยกเลิกทุกรายการในใบนี้" style={{ width: 15, height: 15, cursor: "pointer" }} />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rcpt.lines.map((l, i) => (
                          <tr key={l.line_id} style={{ borderTop: "1px solid #e5e7eb", background: selected[l.line_id] ? "#ecfdf5" : "transparent" }}>
                            <td style={td}>{i + 1}</td>
                            <td style={td}>{l.income_type || "-"}</td>
                            <td style={{ ...td, fontFamily: "monospace" }}>{l.income_code || "-"}</td>
                            <td style={td}>{l.income_name || "-"}</td>
                            <td style={td}>{l.description || "-"}</td>
                            <td style={tdNum}>{fmtNum(l.qty)}</td>
                            <td style={tdNum}>{fmtNum(l.price_before_discount)}</td>
                            <td style={tdNum}>{fmtNum(l.discount)}</td>
                            <td style={{ ...tdNum, color: "#dc2626", fontWeight: 600 }}>{fmtNum(l.net_price)}</td>
                            <td style={{ ...td, textAlign: "center" }}>
                              <input type="checkbox" checked={!!selected[l.line_id]} onChange={() => toggleLineSelect(l)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot style={{ background: "#fef9c3" }}>
                        <tr>
                          <td colSpan={5} style={{ ...td, textAlign: "right", fontWeight: 700 }}>รวม {rcpt.lines.length} รายการ</td>
                          <td style={{ ...tdNum, fontWeight: 700 }}>{fmtNum(rcpt.lines.reduce((s, l) => s + Number(l.qty || 0), 0))}</td>
                          <td style={{ ...tdNum, fontWeight: 700 }}>{fmtNum(rcpt.lines.reduce((s, l) => s + Number(l.price_before_discount || 0), 0))}</td>
                          <td style={{ ...tdNum, fontWeight: 700 }}>{fmtNum(rcpt.lines.reduce((s, l) => s + Number(l.discount || 0), 0))}</td>
                          <td style={{ ...tdNum, fontWeight: 700, color: "#dc2626" }}>{fmtNum(lineSum)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {tab === "history" && (
        <>
          {/* History filter */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่ส่ง:</label>
            <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} style={inputStyle} />
            <span>ถึง</span>
            <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} style={inputStyle} />
            <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)} style={inputStyle}>
              <option value="">ทุกสถานะ</option>
              <option value="submitted">ส่งแล้ว (รอรับงาน)</option>
              <option value="received">รับงานแล้ว</option>
              <option value="billed">วางบิลแล้ว</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
            <input type="text" placeholder="🔍 ค้นหา (เลขใบ, Supplier, หมายเหตุ)"
              value={historySearch} onChange={e => setHistorySearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchHistory()}
              style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
            <button onClick={fetchHistory} disabled={historyLoading}
              style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
              {historyLoading ? "..." : "🔍 ค้นหา"}
            </button>
          </div>

          {/* Summary */}
          {(() => {
            // กรองเอา batches ที่ไม่ใช่ cancelled ออก เว้นแต่ user เลือก filter "cancelled" โดยตั้งใจ
            const visibleBatches = historyStatus === "cancelled"
              ? historyBatches
              : historyBatches.filter(b => b.status !== "cancelled");
            return (
          <>
          <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13 }}>📦 batch: <strong>{visibleBatches.length}</strong></span>
            <span style={{ fontSize: 13 }}>📋 รายการรวม: <strong>{visibleBatches.reduce((s, b) => s + Number(b.items_count || 0), 0)}</strong></span>
            <span style={{ fontSize: 13 }}>ยอดสุทธิรวม: <strong style={{ color: "#dc2626" }}>{fmtNum(visibleBatches.reduce((s, b) => s + Number(b.items_total || 0), 0))}</strong></span>
          </div>

          {/* Batches list */}
          {historyLoading ? (
            <div style={{ padding: 30, textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: 10 }}>กำลังโหลด...</div>
          ) : visibleBatches.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10 }}>ยังไม่มีประวัติการส่ง — กดปุ่มค้นหา</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleBatches.map(b => {
                const open = !!historyExpanded[b.batch_id];
                const statusColor = {
                  submitted: { bg: "#dbeafe", fg: "#1e40af", label: "ส่งแล้ว · รอรับงาน" },
                  received:  { bg: "#d1fae5", fg: "#065f46", label: "รับงานแล้ว" },
                  billed:    { bg: "#ede9fe", fg: "#5b21b6", label: "วางบิลแล้ว" },
                  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "ยกเลิก" },
                }[b.status] || { bg: "#f3f4f6", fg: "#374151", label: b.status };
                return (
                  <div key={b.batch_id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                    <div onClick={() => toggleHistory(b.batch_id)}
                      style={{ padding: "10px 14px", background: "linear-gradient(90deg,#1e3a8a 0%,#3b82f6 100%)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 14 }}>{open ? "▾" : "▸"}</span>
                      <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto auto auto", gap: 14, flex: 1, alignItems: "center", fontSize: 13 }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{b.batch_code}</span>
                        <span style={{ background: "#fff3", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{fmtDate(b.submission_date)}</span>
                        <span><strong>📍 {b.destination || "-"}</strong> · {b.items_count} รายการ</span>
                        <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 11, background: statusColor.bg, color: statusColor.fg, fontWeight: 600 }}>
                          {statusColor.label}
                        </span>
                        <span style={{ fontWeight: 700 }}>฿ {fmtNum(b.items_total)}</span>
                        <span style={{ fontSize: 11, opacity: 0.85 }}>by {b.created_by || "-"}</span>
                      </div>
                    </div>

                    {open && (
                      <>
                        <div style={{ padding: "8px 14px", background: "#f8fafc", borderTop: "1px solid #e5e7eb", display: "flex", gap: 18, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
                          {b.note && <span><strong>หมายเหตุ:</strong> {b.note}</span>}
                          {b.received_at && <span style={{ color: "#065f46" }}><strong>📥 รับงาน:</strong> {new Date(b.received_at).toLocaleString("th-TH")} โดย {b.received_by || "-"}</span>}
                          {b.billed_at && <span style={{ color: "#5b21b6" }}><strong>💰 วางบิล:</strong> {b.billing_doc_no} · {new Date(b.billed_at).toLocaleString("th-TH")}</span>}
                          {b.cancelled_at && <span style={{ color: "#991b1b" }}><strong>❌ ยกเลิก:</strong> {new Date(b.cancelled_at).toLocaleString("th-TH")} {b.cancel_reason ? `· ${b.cancel_reason}` : ""}</span>}
                          <div style={{ flex: 1 }} />
                          <button onClick={() => reprintCoverSheet(b)}
                            style={{ padding: "5px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            🖨️ พิมพ์ใบปะหน้าซ้ำ
                          </button>
                          {b.status === "submitted" && (
                            <button onClick={() => cancelBatch(b)}
                              style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                              ❌ ยกเลิก batch
                            </button>
                          )}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead style={{ background: "#f3f4f6" }}>
                            <tr>
                              <th style={th}>#</th>
                              <th style={th}>เลขที่รับ</th>
                              <th style={th}>ลูกค้า</th>
                              <th style={th}>ยี่ห้อ/รุ่น</th>
                              <th style={th}>เลขตัวถัง</th>
                              <th style={th}>ทะเบียน</th>
                              <th style={th}>ประเภท</th>
                              <th style={th}>ชื่อรายได้</th>
                              <th style={th}>จำนวน</th>
                              <th style={th}>สุทธิ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(b.items || []).map((it, i) => (
                              <tr key={it.item_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                                <td style={td}>{i + 1}</td>
                                <td style={{ ...td, fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{it.receipt_no}</td>
                                <td style={td}>{it.customer_name || "-"}</td>
                                <td style={td}>{it.brand} {it.model_series}</td>
                                <td style={{ ...td, fontFamily: "monospace" }}>{it.chassis_no || "-"}</td>
                                <td style={td}>{it.plate_number || "-"}</td>
                                <td style={td}>{it.income_type || "-"}</td>
                                <td style={td}>{it.income_name || "-"}</td>
                                <td style={tdNum}>{fmtNum(it.qty)}</td>
                                <td style={{ ...tdNum, color: "#dc2626", fontWeight: 600 }}>{fmtNum(it.net_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </>
            );
          })()}
        </>
      )}

      {/* Submit dialog */}
      {submitDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !submitting && setSubmitDialog(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 22, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>📤 ส่งเรื่องงานทะเบียน</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>วันที่ส่ง *</label>
                <input type="date" value={submissionDate} onChange={e => setSubmissionDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>ชื่อ Supplier *</label>
                <select value={destination} onChange={e => setDestination(e.target.value)} style={inp}>
                  <option value="">-- เลือก Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.vendor_id} value={s.vendor_name}>{s.vendor_name}</option>
                  ))}
                </select>
                {!suppliersLoaded ? (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>กำลังโหลดรายชื่อ...</div>
                ) : suppliers.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>⚠️ ไม่มี Supplier — ไปเพิ่มที่ Master Data → Supplier ก่อน</div>
                ) : null}
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={submitNote} onChange={e => setSubmitNote(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              <strong>📋 รายการที่จะส่ง: {selCount} รายการ จาก {selReceipts.length} ใบ</strong> · ยอดรวม <strong style={{ color: "#dc2626" }}>{fmtNum(selTotal)}</strong> บาท
            </div>

            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={th}>เลขที่รับ</th>
                    <th style={th}>ลูกค้า</th>
                    <th style={th}>ชื่อรายได้</th>
                    <th style={th}>สุทธิ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLines.map(l => (
                    <tr key={l.line_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...td, fontFamily: "monospace" }}>{l.receipt_no}</td>
                      <td style={td}>{l.customer_name}</td>
                      <td style={td}>{l.income_name}</td>
                      <td style={tdNum}>{fmtNum(l.net_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button disabled={submitting} onClick={() => setSubmitDialog(false)}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={doSubmit} disabled={submitting || !destination.trim()}
                style={{ padding: "8px 20px", background: submitting || !destination.trim() ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: submitting || !destination.trim() ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {submitting ? "กำลังบันทึก..." : "📤 บันทึก + พิมพ์ใบปะหน้า"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#374151" };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };

function buildCoverSheetHTML(batch, fmtNum, fmtDate, fmtBranch) {
  const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const items = batch.items || [];
  const total = items.reduce((s, l) => s + Number(l.net_price || 0), 0);
  const totalQty = items.reduce((s, l) => s + Number(l.qty || 0), 0);
  const uniqRcpt = [...new Set(items.map(i => i.receipt_no))].length;
  const trs = items.map((l, i) => `<tr>
    <td>${i + 1}</td>
    <td class="mono">${safe(l.receipt_no)}</td>
    <td>${fmtDate(l.receive_date)}</td>
    <td>${safe(l.customer_name)}</td>
    <td>${safe(l.brand)} ${safe(l.model_series)}</td>
    <td class="mono">${safe(l.chassis_no)}</td>
    <td>${safe(l.plate_number)}</td>
    <td>${safe(l.income_type)}</td>
    <td>${safe(l.income_name)}</td>
    <td>${safe(l.description)}</td>
    <td class="num">${fmtNum(l.qty)}</td>
    <td class="num">${fmtNum(l.net_price)}</td>
  </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบปะหน้า ${safe(batch.batch_code)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 10pt; color: #111; }
.cover-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #072d6b; padding-bottom: 8px; margin-bottom: 10px; }
.cover-head h1 { margin: 0 0 2px; font-size: 16pt; color: #072d6b; }
.cover-head .meta { font-size: 10pt; }
.info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; font-size: 10pt; }
.info .k { color: #666; font-size: 8pt; }
.info .v { font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #555; padding: 4px 6px; font-size: 9pt; text-align: left; vertical-align: top; }
th { background: #f0f4f9; font-size: 9pt; }
.num { text-align: right; font-family: monospace; }
.mono { font-family: monospace; }
.total { background: #fef9c3; font-weight: 700; }
.note { margin-top: 10px; font-size: 10pt; }
.signatures { display: flex; justify-content: space-around; margin-top: 35px; font-size: 10pt; }
.sig-box { text-align: center; width: 30%; }
.sig-line { border-top: 1px solid #333; padding-top: 4px; }
</style></head><body>
<div class="cover-head">
  <div>
    <h1>ใบปะหน้า — ส่งงานทะเบียน</h1>
    <div class="meta">เลขที่ใบส่ง: <strong style="font-family:monospace">${safe(batch.batch_code)}</strong></div>
  </div>
  <div style="text-align:right">
    <div>วันที่ส่ง: <strong>${fmtDate(batch.submission_date)}</strong></div>
    <div>ปลายทาง: <strong>${safe(batch.destination)}</strong></div>
    <div style="font-size:9pt;color:#666">ผู้ส่ง: ${safe(batch.created_by)}</div>
  </div>
</div>

<div class="info">
  <div><div class="k">จำนวนใบรับเรื่อง</div><div class="v">${uniqRcpt}</div></div>
  <div><div class="k">จำนวนรายการ</div><div class="v">${items.length}</div></div>
  <div><div class="k">จำนวนรวม</div><div class="v">${fmtNum(totalQty)}</div></div>
  <div><div class="k">ยอดสุทธิรวม</div><div class="v" style="color:#dc2626">${fmtNum(total)} บาท</div></div>
</div>

<table>
  <thead><tr>
    <th>#</th>
    <th>เลขที่รับ</th>
    <th>วันที่รับ</th>
    <th>ลูกค้า</th>
    <th>ยี่ห้อ/รุ่น</th>
    <th>เลขตัวถัง</th>
    <th>ทะเบียน</th>
    <th>ประเภทรายได้</th>
    <th>ชื่อรายได้</th>
    <th>รายละเอียด</th>
    <th>จำนวน</th>
    <th>ยอดสุทธิ</th>
  </tr></thead>
  <tbody>
    ${trs}
    <tr class="total">
      <td colspan="10" style="text-align:right">รวม ${items.length} รายการ</td>
      <td class="num">${fmtNum(totalQty)}</td>
      <td class="num">${fmtNum(total)}</td>
    </tr>
  </tbody>
</table>

${batch.note ? `<div class="note"><strong>หมายเหตุ:</strong> ${safe(batch.note)}</div>` : ""}

<div class="signatures">
  <div class="sig-box"><div style="height:40px"></div><div class="sig-line">ลงชื่อ ........................................................<br/>ผู้ส่ง</div></div>
  <div class="sig-box"><div style="height:40px"></div><div class="sig-line">ลงชื่อ ........................................................<br/>ผู้รับ (ปลายทาง)</div></div>
  <div class="sig-box"><div style="height:40px"></div><div class="sig-line">ลงชื่อ ........................................................<br/>ผู้ตรวจ</div></div>
</div>
</body></html>`;
}

function KV({ label, value, mono }) {
  return (
    <div>
      <span style={{ color: "#6b7280" }}>{label}: </span>
      <span style={{ fontWeight: 600, fontFamily: mono ? "monospace" : "inherit" }}>{value || "-"}</span>
    </div>
  );
}

const inputStyle = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "7px 8px", fontSize: 12 };
const tdNum = { padding: "7px 8px", fontSize: 12, textAlign: "right", fontFamily: "monospace" };
