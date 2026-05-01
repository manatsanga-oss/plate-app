import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function ReceiveReceiptPage({ currentUser }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState({});
  const [selected, setSelected] = useState({}); // { item_id: true }
  const [lastSavedIds, setLastSavedIds] = useState(null); // ids ของรายการที่เพิ่ง save (สำหรับกรองหลัง save)

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchData() {
    setLoading(true);
    setSelected({});
    try {
      const data = await post({
        action: "get_submission_batches",
        date_from: dateFrom || null,
        date_to: dateTo || null,
        status: filterStatus,
        keyword: search.trim(),
      });
      setBatches(Array.isArray(data) ? data : []);
    } catch { setBatches([]); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [filterStatus]);

  function toggleItem(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleBatchItems(batch, on) {
    const next = { ...selected };
    (batch.items || []).forEach(it => {
      if (on) next[it.item_id] = true;
      else delete next[it.item_id];
    });
    setSelected(next);
  }

  async function markItems(action, items, batch) {
    if (items.length === 0) { setMessage("เลือกรายการก่อน"); return; }
    const label = action === "mark_batch_received_back" ? "รับคืน" : "ส่งคืนร้านรับเรื่อง";
    if (!window.confirm(`บันทึก${label} ${items.length} รายการ จาก ${batch.batch_code}?`)) return;
    try {
      const savedIds = items.map(it => it.item_id);
      await post({
        action,
        item_ids: savedIds,
        by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ บันทึก${label} ${items.length} รายการสำเร็จ`);
      setSelected({});
      setLastSavedIds(savedIds);  // เก็บ ids ที่เพิ่งบันทึก
      // Auto-switch: รับคืน → รอส่งร้านรับเรื่อง, ส่งคืน → ส่งคืนร้านรับเรื่องแล้ว
      const nextFilter = action === "mark_batch_received_back" ? "received" : "returned";
      if (filterStatus !== nextFilter) {
        setFilterStatus(nextFilter);
      } else {
        fetchData();
      }
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
  }

  async function undoItems(items, batch) {
    if (items.length === 0) { setMessage("เลือกรายการก่อน"); return; }
    if (!window.confirm(`ยกเลิกสถานะ ${items.length} รายการ จาก ${batch.batch_code}?\n(ถ้าส่งคืนแล้ว → กลับเป็นรอส่งร้านรับเรื่อง · ถ้ารับคืนแล้ว → กลับเป็นรอจัดการ)`)) return;
    try {
      await post({
        action: "undo_item_status",
        item_ids: items.map(it => it.item_id),
      });
      setMessage(`✅ ยกเลิก ${items.length} รายการสำเร็จ`);
      setSelected({});
      fetchData();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  function printReturnDoc(batch, returnedItems) {
    const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const today = new Date();
    const pad = n => String(n).padStart(2, "0");
    const printDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear() + 543} ${pad(today.getHours())}:${pad(today.getMinutes())}`;
    const total = returnedItems.reduce((s, it) => s + Number(it.net_price || 0), 0);
    const trs = returnedItems.map((it, i) => `<tr>
      <td>${i + 1}</td>
      <td class="mono">${safe(it.receipt_no)}</td>
      <td>${safe(it.customer_name)}</td>
      <td class="mono">${safe(it.chassis_no)}</td>
      <td>${safe(it.plate_number || "-")}</td>
      <td>${safe(it.income_name || it.income_type || "-")}</td>
      <td class="num">${Number(it.net_price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
    </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบส่งคืน ${safe(batch.batch_code)}</title>
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
<h1>ใบส่งคืนงานทะเบียน — ให้ร้านรับเรื่อง</h1>
<div class="head">เลขที่ batch: <strong>${safe(batch.batch_code)}</strong> · วันที่ส่ง: ${batch.submission_date ? new Date(batch.submission_date).toLocaleDateString("th-TH") : "-"}<br/>วันที่พิมพ์: ${printDate}</div>
<div class="info">
  <div><strong>ร้านรับเรื่อง:</strong> ${safe(batch.destination || "-")}</div>
  <div><strong>จำนวนรายการ:</strong> ${returnedItems.length}</div>
  <div><strong>ผู้ดำเนินการ:</strong> ${safe(batch.created_by || "-")}</div>
  <div><strong>ยอดรวม:</strong> ${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</div>
</div>
<table>
  <thead><tr><th>#</th><th>เลขที่รับเรื่อง</th><th>ลูกค้า</th><th>เลขถัง</th><th>ทะเบียน</th><th>รายการ</th><th>ยอด</th></tr></thead>
  <tbody>
    ${trs}
    <tr class="total"><td colspan="6" style="text-align:right">รวมทั้งสิ้น</td><td class="num">${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
  </tbody>
</table>
<div style="margin-top:25px;">
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px">ลงชื่อ ........................................................<br/>ผู้ส่งคืน (ตัวแทน/บริษัท)</div></div>
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px">ลงชื่อ ........................................................<br/>ผู้รับคืน (ร้านรับเรื่อง)</div></div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) { setMessage("❌ Popup ถูกบล็อก"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  async function cancelBatch(batch) {
    const reason = window.prompt(`ยกเลิกใบ ${batch.batch_code}?\n\nรายการทั้งหมด ${batch.items_count} รายการจะกลับไปรอส่งใหม่\nกรุณาระบุเหตุผล:`);
    if (reason === null) return;
    try {
      await post({
        action: "cancel_submission_batch",
        batch_id: batch.batch_id,
        cancel_reason: reason || "",
        cancelled_by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ ยกเลิกใบ ${batch.batch_code} แล้ว`);
      fetchData();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }
  function fmtNum(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function batchStatusBadge(b) {
    if (b.status === "cancelled") return { label: "ยกเลิก", color: "#dc2626", bg: "#fee2e2" };
    const total = b.items_count || (b.items?.length || 0);
    const received = b.received_count || 0;
    const returned = b.returned_count || 0;
    if (returned === total && total > 0) return { label: "✅ ส่งคืนร้านรับเรื่องครบแล้ว", color: "#065f46", bg: "#dcfce7" };
    if (received === total && total > 0) return { label: "📥 รับคืนครบแล้ว", color: "#1e40af", bg: "#dbeafe" };
    if (received > 0 || returned > 0) return { label: `📥 ${received}/${total} · ✅ ${returned}/${total}`, color: "#0369a1", bg: "#e0f2fe" };
    return { label: "⏳ ส่งแล้ว · รอรับคืน", color: "#92400e", bg: "#fef3c7" };
  }

  function itemStatusBadge(it) {
    if (it.returned_at) return { label: "✅ ส่งคืนแล้ว", color: "#065f46", bg: "#dcfce7" };
    if (it.received_back_at) return { label: "📥 รับคืนแล้ว", color: "#1e40af", bg: "#dbeafe" };
    return { label: "⏳ รอรับ", color: "#92400e", bg: "#fef3c7" };
  }

  const grandItems = batches.reduce((s, b) => s + (b.items_count || 0), 0);
  const grandTotal = batches.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const totalSelected = Object.values(selected).filter(Boolean).length;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📥 บันทึกรับ/ส่งคืน งานรับเรื่องงานทะเบียน</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1 }}>{message}</span>
          {lastSavedIds && lastSavedIds.length > 0 && (
            <button onClick={() => { setLastSavedIds(null); setFilterStatus("all"); setMessage(""); }}
              style={{ padding: "6px 16px", background: "#fff", color: "#065f46", border: "1px solid #065f46", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              ⬅ กลับหน้าแรก
            </button>
          )}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>วันที่ส่ง:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />

        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setLastSavedIds(null); }} style={inp}>
          <option value="all">📋 ทั้งหมด</option>
          <option value="pending">⏳ รอจัดการ</option>
          <option value="received">📥 รอส่งร้านรับเรื่อง</option>
          <option value="returned">✅ ส่งคืนร้านรับเรื่องแล้ว</option>
        </select>

        <input type="text" placeholder="🔍 ค้นหา (เลข batch, supplier)"
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchData()}
          style={{ ...inp, flex: 1, minWidth: 200 }} />

        <button onClick={() => { setLastSavedIds(null); fetchData(); }} disabled={loading}
          style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔍 ค้นหา"}
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
        <span>📦 batch: <strong>{batches.length}</strong></span>
        <span>📋 รายการรวม: <strong>{grandItems}</strong></span>
        <span>💰 ยอดสุทธิรวม: <strong style={{ color: "#dc2626" }}>{fmtNum(grandTotal)}</strong></span>
        {totalSelected > 0 && (
          <span style={{ marginLeft: "auto", padding: "4px 12px", background: "#fef3c7", borderRadius: 12, color: "#92400e", fontWeight: 600 }}>
            ✓ เลือก {totalSelected} รายการ
          </span>
        )}
      </div>

      {/* Batches list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
      ) : batches.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่มี batch
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {batches.map(b => {
            const st = batchStatusBadge(b);
            const isOpen = !!expanded[b.batch_id];
            const allItems = b.items || [];
            // Filter items ตาม filterStatus — แสดงเฉพาะรายการที่ตรงกับ filter
            let items = allItems.filter(it => {
              if (filterStatus === "pending") return !it.received_back_at;
              if (filterStatus === "received") return it.received_back_at && !it.returned_at;
              if (filterStatus === "returned") return !!it.returned_at;
              return true; // 'all'
            });
            // ถ้าเพิ่ง save → แสดงเฉพาะ items ที่เพิ่งบันทึก
            if (lastSavedIds && lastSavedIds.length > 0) {
              items = items.filter(it => lastSavedIds.includes(it.item_id));
            }
            // ถ้า filter ทำให้ batch ไม่มี items ที่แสดง — ซ่อน batch ไปเลย
            if (items.length === 0) return null;
            const selectedInBatch = items.filter(it => selected[it.item_id]);
            const allInBatchSelected = items.length > 0 && items.every(it => selected[it.item_id] || it.returned_at);
            const pendingItems = items.filter(it => !it.received_back_at);
            const receivedItems = items.filter(it => it.received_back_at && !it.returned_at);

            return (
              <div key={b.batch_id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                {/* Batch header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#1e3a8a", color: "#fff" }}>
                  <button onClick={() => setExpanded(p => ({ ...p, [b.batch_id]: !p[b.batch_id] }))}
                    style={{ background: "transparent", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}>
                    {isOpen ? "▼" : "▶"}
                  </button>
                  <strong style={{ fontFamily: "monospace", fontSize: 16, color: "#fff" }}>{b.batch_code}</strong>
                  <span style={{ background: "#cbd5e1", color: "#1e293b", padding: "2px 10px", borderRadius: 6, fontSize: 12 }}>{fmtDate(b.submission_date)}</span>
                  <span style={{ flex: 1 }}>📍 {b.destination || "-"} · {items.length} รายการ</span>
                  <span style={{ background: st.bg, color: st.color, padding: "3px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{st.label}</span>
                  <strong style={{ color: "#fbbf24", fontSize: 15 }}>฿ {fmtNum(b.total_amount)}</strong>
                  {/* Print button — บนหัว batch (เลือก 1 พิมพ์ 1, ไม่เลือก พิมพ์ทุก returned) */}
                  {(() => {
                    const selectedReturned = selectedInBatch.filter(it => it.returned_at);
                    const allReturned = items.filter(it => it.returned_at);
                    const printable = selectedReturned.length > 0 ? selectedReturned : allReturned;
                    if (printable.length === 0) return null;
                    return (
                      <button
                        onClick={(e) => { e.stopPropagation(); printReturnDoc(b, printable); }}
                        title={selectedReturned.length > 0 ? `พิมพ์ ${selectedReturned.length} รายการที่เลือก` : `พิมพ์ทั้งหมด ${allReturned.length} รายการที่ส่งคืนแล้ว`}
                        style={{ padding: "5px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
                        🖨️ พิมพ์ ({printable.length})
                      </button>
                    );
                  })()}
                  <span style={{ fontSize: 11, color: "#cbd5e1" }}>by {b.created_by || "-"}</span>
                </div>

                {/* Action bar */}
                {b.status !== "cancelled" && items.length > 0 && (
                  <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={allInBatchSelected}
                        onChange={(e) => toggleBatchItems(b, e.target.checked)} />
                      เลือกทั้ง batch
                    </label>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>เลือก {selectedInBatch.length} รายการ</span>
                    <div style={{ flex: 1 }} />
                    {(() => {
                      const selPending = selectedInBatch.filter(it => !it.received_back_at);
                      const selReceived = selectedInBatch.filter(it => it.received_back_at && !it.returned_at);
                      return (
                        <>
                          {/* แสดง "รับคืน" เมื่อมี pending items (หรือ selected pending) */}
                          {pendingItems.length > 0 && (
                            <button
                              onClick={() => markItems("mark_batch_received_back",
                                selPending.length > 0 ? selPending : pendingItems,
                                b)}
                              style={{ padding: "8px 16px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                              📥 บันทึกรับคืน {selPending.length > 0 ? `(${selPending.length})` : `(ทั้งหมด ${pendingItems.length})`}
                            </button>
                          )}
                          {/* แสดง "ส่งคืน" เฉพาะเมื่อ user เลือก items ที่รับคืนแล้ว (received) */}
                          {selReceived.length > 0 && (
                            <button
                              onClick={() => markItems("mark_batch_returned", selReceived, b)}
                              style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                              ✅ บันทึกส่งคืนร้านรับเรื่อง ({selReceived.length})
                            </button>
                          )}
                        </>
                      );
                    })()}
                    {selectedInBatch.length > 0 && selectedInBatch.some(it => it.received_back_at || it.returned_at) && (
                      <button
                        onClick={() => undoItems(selectedInBatch.filter(it => it.received_back_at || it.returned_at), b)}
                        style={{ padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        ↩️ ยกเลิก ({selectedInBatch.filter(it => it.received_back_at || it.returned_at).length})
                      </button>
                    )}
                    {/* Cancel whole submission batch — show only when batch is fully pending (สีเหลือง) */}
                    {selectedInBatch.length === 0 && pendingItems.length === items.length && b.status !== "cancelled" && (
                      <button
                        onClick={() => cancelBatch(b)}
                        title="ยกเลิกใบทั้งหมด — รายการจะกลับไปรอส่งใหม่"
                        style={{ padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        🚫 ยกเลิกใบ
                      </button>
                    )}
                  </div>
                )}

                {/* Items table */}
                {isOpen && items.length > 0 && (
                  <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb", overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead style={{ background: "#f3f4f6" }}>
                        <tr>
                          <th style={{ padding: "6px 8px", width: 30 }}>
                            <input type="checkbox" checked={items.length > 0 && items.every(it => selected[it.item_id])}
                              onChange={(e) => toggleBatchItems(b, e.target.checked)} />
                          </th>
                          <th style={th}>เลขที่รับเรื่อง</th>
                          <th style={th}>ลูกค้า</th>
                          <th style={th}>เลขถัง</th>
                          <th style={th}>ทะเบียน</th>
                          <th style={th}>รายการ</th>
                          <th style={{ ...th, textAlign: "right" }}>ยอด</th>
                          <th style={th}>สถานะ</th>
                          <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => {
                          const ist = itemStatusBadge(it);
                          const canUndo = !!(it.received_back_at || it.returned_at);
                          return (
                            <tr key={it.item_id || i} style={{ borderTop: "1px solid #e5e7eb", background: selected[it.item_id] ? "#fef9c3" : "transparent" }}>
                              <td style={{ padding: "6px 8px" }}>
                                <input type="checkbox" checked={!!selected[it.item_id]}
                                  onChange={() => toggleItem(it.item_id)} />
                              </td>
                              <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{it.receipt_no || "-"}</td>
                              <td style={td}>{it.customer_name || "-"}</td>
                              <td style={{ ...td, fontFamily: "monospace" }}>{it.chassis_no || "-"}</td>
                              <td style={td}>{it.plate_number || "-"}</td>
                              <td style={td}>{it.income_name || it.income_type || "-"}</td>
                              <td style={{ ...td, textAlign: "right" }}>{fmtNum(it.net_price)}</td>
                              <td style={td}>
                                <span style={{ display: "inline-block", padding: "2px 8px", background: ist.bg, color: ist.color, borderRadius: 8, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{ist.label}</span>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                {canUndo && (
                                  <button onClick={() => undoItems([it], b)}
                                    title={it.returned_at ? "ยกเลิก: กลับเป็นรอส่งร้านรับเรื่อง" : "ยกเลิก: กลับเป็นรอจัดการ"}
                                    style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                    ↩️ ยกเลิก
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inp = { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "#374151" };
const td = { padding: "6px 10px", fontSize: 12, color: "#1f2937" };
