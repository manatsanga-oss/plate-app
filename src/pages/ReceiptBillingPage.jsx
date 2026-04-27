import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const MASTER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

export default function ReceiptBillingPage({ currentUser }) {
  const [viewMode, setViewMode] = useState("pending");  // 'pending' | 'history'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendor, setVendor] = useState("");
  const [incomeType, setIncomeType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showBilled, setShowBilled] = useState(false);
  const [search, setSearch] = useState("");
  const [batchFilters, setBatchFilters] = useState([]);
  const [selected, setSelected] = useState({});
  const [selectedBills, setSelectedBills] = useState({});  // {billing_doc_no: true}
  const [historyExpanded, setHistoryExpanded] = useState({});
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);

  useEffect(() => { fetchVendors(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [vendor, incomeType, showBilled]);
  useEffect(() => {
    if (viewMode === "history") setShowBilled(true);
    else setShowBilled(false);
  }, [viewMode]);

  function printBillingDoc(group) {
    const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const today = new Date();
    const pad = n => String(n).padStart(2, "0");
    const dateStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear() + 543} ${pad(today.getHours())}:${pad(today.getMinutes())}`;
    const billDate = group.billed_at ? new Date(group.billed_at) : null;
    const billDateStr = billDate ? `${pad(billDate.getDate())}/${pad(billDate.getMonth() + 1)}/${billDate.getFullYear() + 543}` : "-";
    const trs = group.items.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td class="mono">${safe(r.receipt_no)}</td>
      <td>${safe(r.customer_name)}</td>
      <td>${safe(r.income_name)}</td>
      <td class="num">${fmtNum(r.net_price)}</td>
      <td class="num">${fmtNum(r.bill_amount)}</td>
    </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบวางบิล ${safe(group.billing_doc_no)}</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; color: #072d6b; }
.head { text-align: center; margin-bottom: 14px; font-size: 10pt; color: #444; }
.info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 12px; padding: 10px; background: #f0f4f9; border-radius: 6px; font-size: 10pt; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #555; padding: 5px 8px; font-size: 10pt; text-align: left; }
th { background: #f0f4f9; }
.num { text-align: right; font-family: monospace; }
.mono { font-family: monospace; }
.total { font-weight: 700; background: #fef9c3; }
.sign-box { display: inline-block; width: 45%; margin-top: 30px; padding: 0 10px; vertical-align: top; }
</style></head><body>
<h1>ใบวางบิล — งานรับเรื่อง</h1>
<div class="head">เลขใบวางบิล: <strong>${safe(group.billing_doc_no)}</strong> · วันที่: ${billDateStr}<br/>พิมพ์: ${dateStr}</div>
<table>
  <thead><tr><th>#</th><th>เลขที่รับ</th><th>ลูกค้า</th><th>ชื่อรายได้</th><th>ยอดรายได้</th><th>ยอดบิล</th></tr></thead>
  <tbody>
    ${trs}
    <tr class="total"><td colspan="5" style="text-align:right">รวมทั้งสิ้น</td><td class="num">${fmtNum(group.total)}</td></tr>
  </tbody>
</table>
<div style="margin-top:25px;">
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px">ลงชื่อ ........................................................<br/>ผู้วางบิล</div></div>
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px">ลงชื่อ ........................................................<br/>ผู้รับวางบิล</div></div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  async function saveBilling() {
    const items = filtered.filter(r => selected[r.item_id]).map(r => ({
      item_id: r.item_id,
      bill_amount: r.bill_amount || 0,
    }));
    if (!items.length) { setMessage("❌ เลือกรายการก่อน"); return; }
    if (!window.confirm(`บันทึกวางบิล ${items.length} รายการ\nยอดรวม: ${items.reduce((s, x) => s + Number(x.bill_amount || 0), 0).toLocaleString()} บาท`)) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_receipt_billing",
          items,
          billed_by: currentUser?.username || "system",
        }),
      });
      const data = await res.json();
      const docNo = data?.billing_doc_no || data?.[0]?.billing_doc_no || "";
      setMessage(`✅ บันทึกใบวางบิล ${docNo} สำเร็จ ${items.length} รายการ`);
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function fetchVendors() {
    try {
      const res = await fetch(MASTER_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }),
      });
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch { setVendors([]); }
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    setSelected({});
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_receipt_billing_data",
          vendor: vendor || null,
          income_type: incomeType || null,
          only_unbilled: !showBilled,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }

  // unique batch codes & income types from rows
  const batchOpts = [...new Set(rows.map(r => r.batch_code).filter(Boolean))].sort();
  const incomeTypeOpts = [...new Set(rows.map(r => r.income_type).filter(Boolean))].sort();

  function toggleBatch(code) {
    setBatchFilters(bs => bs.includes(code) ? bs.filter(x => x !== code) : [...bs, code]);
  }

  // local search + batch filter
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (batchFilters.length > 0 && !batchFilters.includes(r.batch_code)) return false;
    if (!kw) return true;
    const hay = [r.receipt_no, r.customer_name, r.chassis_no, r.plate_number, r.income_name, r.batch_code]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const selectedRows = filtered.filter(r => selected[r.item_id]);
  const selCount = selectedRows.length;
  const selTotal = selectedRows.reduce((s, r) => s + Number(r.bill_amount || 0), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.item_id])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.item_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.item_id] = true; });
      setSelected(next);
    }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 วางบิลงานรับเรื่อง</h2>
      </div>

      {/* View mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["pending", "📋 รอวางบิล"],
          ["history", "💵 บันทึกจ่ายเงิน"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setViewMode(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: viewMode === v ? "#072d6b" : "#6b7280",
              borderBottom: viewMode === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Vendor:</label>
        <select value={vendor} onChange={e => setVendor(e.target.value)} style={{ ...inp, minWidth: 180 }}>
          <option value="">ทุก Vendor</option>
          {vendors.map(v => <option key={v.vendor_id} value={v.vendor_name}>{v.vendor_name}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>ประเภทรายได้:</label>
        <select value={incomeType} onChange={e => setIncomeType(e.target.value)} style={{ ...inp, minWidth: 200 }}>
          <option value="">ทุกประเภท</option>
          {incomeTypeOpts.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showBilled} onChange={e => setShowBilled(e.target.checked)} />
          แสดงที่วางบิลแล้ว
        </label>

        <button onClick={fetchData}
          style={{ padding: "7px 12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🔄</button>
      </div>

      {/* Batch filter chips */}
      {batchOpts.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <strong style={{ fontSize: 13, color: "#374151" }}>เลขที่ใบส่งงาน:</strong>
          {batchOpts.map(b => {
            const active = batchFilters.includes(b);
            const count = rows.filter(x => x.batch_code === b).length;
            return (
              <button key={b} onClick={() => toggleBatch(b)}
                style={{ padding: "5px 12px", border: "1px solid " + (active ? "#072d6b" : "#d1d5db"), background: active ? "#072d6b" : "#fff", color: active ? "#fff" : "#374151", borderRadius: 999, cursor: "pointer", fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>
                {active && "✓ "}{b} <span style={{ opacity: 0.7, fontFamily: "Tahoma", marginLeft: 4 }}>({count})</span>
              </button>
            );
          })}
          {batchFilters.length > 0 && (
            <button onClick={() => setBatchFilters([])}
              style={{ padding: "5px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>✕ ล้าง</button>
          )}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24" }}>
        <strong style={{ fontSize: 14, color: "#92400e" }}>
          เลือก {selCount} / {filtered.length} รายการ • ยอดรวม <span style={{ fontSize: 18 }}>{selTotal.toLocaleString()}</span> บาท
        </strong>
        <input type="text" placeholder="🔍 ค้นหา (ลูกค้า, ทะเบียน, เลขถัง)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, marginLeft: "auto", flex: 1, minWidth: 200, maxWidth: 300 }} />
        {viewMode === "pending" && (
          <button onClick={saveBilling} disabled={selCount === 0 || saving}
            style={{ padding: "8px 18px", background: (selCount === 0 || saving) ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (selCount === 0 || saving) ? "not-allowed" : "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
            💾 {saving ? "กำลังบันทึก..." : "บันทึกวางบิล"}
          </button>
        )}
      </div>

      {/* Table or History */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          {viewMode === "history" ? "ยังไม่มีใบวางบิล" : "ไม่มีรายการรอวางบิล (ยังไม่ได้ส่งงาน หรือถูกวางบิลแล้ว)"}
        </div>
      ) : viewMode === "history" ? (
        // ประวัติ — group by billing_doc_no
        (() => {
          const grouped = {};
          filtered.forEach(r => {
            const key = r.billing_doc_no || "(ยังไม่ได้วางบิล)";
            if (!grouped[key]) grouped[key] = { billing_doc_no: key, billed_at: r.billed_at, items: [], total: 0, paid_at: r.paid_at, paid_doc_no: r.paid_doc_no, paid_to_vendor: r.paid_to_vendor };
            grouped[key].items.push(r);
            grouped[key].total += Number(r.bill_amount || 0);
          });
          const groups = Object.values(grouped).sort((a, b) => {
            const da = a.billed_at ? new Date(a.billed_at).getTime() : 0;
            const db = b.billed_at ? new Date(b.billed_at).getTime() : 0;
            return db - da;
          });
          const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
          const selectedGroups = groups.filter(g => selectedBills[g.billing_doc_no]);
          const selSum = selectedGroups.reduce((s, g) => s + g.total, 0);
          return (
            <div>
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", display: "flex", gap: 18, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
                <span>📑 ใบวางบิล: <strong>{groups.length}</strong></span>
                <span>📋 รายการ: <strong>{filtered.length}</strong></span>
                <span>💰 ยอดรวม: <strong style={{ color: "#dc2626" }}>{groups.reduce((s, g) => s + g.total, 0).toLocaleString()}</strong></span>
                {selectedDocNos.length > 0 && (
                  <span style={{ padding: "4px 10px", background: "#fef9c3", borderRadius: 6, fontWeight: 600 }}>
                    ✓ เลือก {selectedDocNos.length} ใบ · ฿ {selSum.toLocaleString()}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {groups.map(g => {
                  const open = !!historyExpanded[g.billing_doc_no];
                  const isPaid = !!g.paid_at;
                  return (
                    <div key={g.billing_doc_no} style={{ background: "#fff", borderRadius: 10, border: selectedBills[g.billing_doc_no] ? "2px solid #059669" : "1px solid #e5e7eb", overflow: "hidden" }}>
                      <div onClick={() => setHistoryExpanded(prev => ({ ...prev, [g.billing_doc_no]: !prev[g.billing_doc_no] }))}
                        style={{ padding: "10px 14px", background: isPaid ? "linear-gradient(90deg,#065f46 0%,#10b981 100%)" : "linear-gradient(90deg,#072d6b 0%,#0e4ba8 100%)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="checkbox"
                          checked={!!selectedBills[g.billing_doc_no]}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setSelectedBills(prev => ({ ...prev, [g.billing_doc_no]: e.target.checked }))}
                          disabled={isPaid}
                          style={{ width: 16, height: 16, cursor: isPaid ? "not-allowed" : "pointer" }} />
                        <span style={{ fontSize: 14 }}>{open ? "▾" : "▸"}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{g.billing_doc_no}</span>
                        <span style={{ background: "#fff3", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>
                          {g.billed_at ? new Date(g.billed_at).toLocaleString("th-TH") : "-"}
                        </span>
                        <span style={{ fontSize: 13 }}>📋 {g.items.length} รายการ</span>
                        {isPaid && (
                          <span style={{ background: "#fff3", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            ✓ จ่ายแล้ว · {g.paid_doc_no || ""}{g.paid_to_vendor ? ` · ${g.paid_to_vendor}` : ""}
                          </span>
                        )}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>฿ {g.total.toLocaleString()}</span>
                        <button onClick={e => { e.stopPropagation(); printBillingDoc(g); }}
                          title="พิมพ์ใบวางบิลซ้ำ"
                          style={{ padding: "4px 10px", background: "#fff2", color: "#fff", border: "1px solid #fff5", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                          🖨️
                        </button>
                      </div>
                      {open && (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead style={{ background: "#f3f4f6" }}>
                            <tr>
                              <th style={th}>#</th>
                              <th style={th}>เลขที่รับ</th>
                              <th style={th}>ลูกค้า</th>
                              <th style={th}>ประเภทรายได้</th>
                              <th style={th}>ชื่อรายได้</th>
                              <th style={{ ...th, textAlign: "right" }}>ยอดรายได้</th>
                              <th style={{ ...th, textAlign: "right" }}>ยอดบิล</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((r, i) => (
                              <tr key={r.item_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                                <td style={td}>{i + 1}</td>
                                <td style={{ ...td, fontFamily: "monospace" }}>{r.receipt_no}</td>
                                <td style={td}>{r.customer_name || "-"}</td>
                                <td style={td}>{r.income_type || "-"}</td>
                                <td style={td}>{r.income_name || "-"}</td>
                                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtNum(r.net_price)}</td>
                                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmtNum(r.bill_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
                            <tr>
                              <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวม {g.items.length} รายการ</td>
                              <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{fmtNum(g.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: 36 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.item_id])} onChange={toggleAll} /></th>
                <th style={th}>เลขใบส่ง</th>
                <th style={th}>เลขที่รับเรื่อง</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>ประเภทรายได้</th>
                <th style={th}>ชื่อรายได้</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดรายได้</th>
                <th style={th}>รายการค่าใช้จ่าย</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดบิล</th>
                <th style={th}>ดู</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const items = Array.isArray(r.bill_items) ? r.bill_items : (r.bill_items ? (typeof r.bill_items === "string" ? JSON.parse(r.bill_items) : r.bill_items) : []);
                const isPaid = !!r.batch_billed_at;
                return (
                  <tr key={r.item_id} style={{ background: selected[r.item_id] ? "#fef9c3" : (isPaid ? "#f9fafb" : "transparent"), borderTop: "1px solid #e5e7eb", cursor: !isPaid ? "pointer" : "default" }}
                    onClick={() => !isPaid && !showBilled && toggleOne(r.item_id)}>
                    <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      {!isPaid && <input type="checkbox" checked={!!selected[r.item_id]} onChange={() => toggleOne(r.item_id)} />}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{r.batch_code}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.receipt_no}</td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={td}>{r.income_type || "-"}</td>
                    <td style={td}>{r.income_name || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtNum(r.net_price)}</td>
                    <td style={{ ...td, fontSize: 11 }}>
                      {items.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {items.map((it, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                              <span>{it.expense_name}</span>
                              <span style={{ fontWeight: 600 }}>{fmtNum(it.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, fontSize: 14, color: r.bill_amount ? "#072d6b" : "#9ca3af" }}>
                      {r.bill_amount ? fmtNum(r.bill_amount) : "—"}
                    </td>
                    <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDetailRow(r)}
                        style={{ padding: "3px 10px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>ดู</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail popup */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>📋 รายละเอียด</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <KV label="เลขใบส่งงาน" value={detailRow.batch_code} mono />
              <KV label="วันที่ส่ง" value={fmtDate(detailRow.submission_date)} />
              <KV label="Vendor" value={detailRow.vendor} />
              <KV label="เลขที่รับเรื่อง" value={detailRow.receipt_no} mono />
              <KV label="ลูกค้า" value={detailRow.customer_name} />
              <KV label="เบอร์โทร" value={detailRow.customer_phone} />
              <KV label="เลขทะเบียน" value={detailRow.plate_number} />
              <KV label="เลขตัวถัง" value={detailRow.chassis_no} mono />
              <KV label="ยี่ห้อ/รุ่น" value={`${detailRow.brand || ''} ${detailRow.model_series || ''}`} />
              <KV label="ประเภทรายได้" value={detailRow.income_type} />
              <KV label="ชื่อรายได้" value={detailRow.income_name} />
              <KV label="ยอดรายได้" value={fmtNum(detailRow.net_price)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setDetailRow(null)}
                style={{ padding: "8px 24px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 600, fontFamily: mono ? "monospace" : "inherit" }}>{value || "-"}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
