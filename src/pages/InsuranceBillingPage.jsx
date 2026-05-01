import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function InsuranceBillingPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState("");
  const [showBilled, setShowBilled] = useState(false);
  const [viewMode, setViewMode] = useState("detail"); // 'detail' | 'summary'
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [claimDialog, setClaimDialog] = useState(null); // { insurance_id, receipt_no, ... }

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
        action: "get_insurance_billing_data",
        only_unbilled: !showBilled,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [showBilled]);

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.policy_no, r.insured_name, r.chassis_no, r.plate_number, r.billing_doc_no]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  // Group by billing_doc_no for summary view
  const groupedByBill = React.useMemo(() => {
    const map = new Map();
    filtered.forEach(r => {
      const key = r.billing_doc_no || "(ยังไม่วางบิล)";
      if (!map.has(key)) {
        map.set(key, {
          billing_doc_no: r.billing_doc_no,
          billed_at: r.billed_at,
          billed_by: r.billed_by,
          count: 0,
          premium: 0,
          total_premium: 0,
          commission: 0,
          premium_remit: 0,
          rows: [],
        });
      }
      const g = map.get(key);
      g.count += 1;
      g.premium += Number(r.premium || 0);
      g.total_premium += Number(r.total_premium || 0);
      g.commission += Number(r.commission || 0);
      g.premium_remit += Number(r.premium_remit || 0);
      g.rows.push(r);
    });
    return Array.from(map.values()).sort((a, b) => {
      const at = a.billed_at ? new Date(a.billed_at).getTime() : 0;
      const bt = b.billed_at ? new Date(b.billed_at).getTime() : 0;
      return bt - at;
    });
  }, [filtered]);

  const selectedRows = filtered.filter(r => selected[r.insurance_id]);
  const selCount = selectedRows.length;
  const selPremium = selectedRows.reduce((s, r) => s + Number(r.premium || 0), 0);
  const selTotalPremium = selectedRows.reduce((s, r) => s + Number(r.total_premium || 0), 0);
  const selCommission = selectedRows.reduce((s, r) => s + Number(r.commission || 0), 0);
  const selRemit = selectedRows.reduce((s, r) => s + Number(r.premium_remit || 0), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.insurance_id])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.insurance_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.insurance_id] = true; });
      setSelected(next);
    }
  }

  async function saveBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อน"); return; }
    const now = new Date();
    const docNo = `INSB-${(now.getFullYear() + 543).toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    if (!window.confirm(`บันทึกใบวางบิลพรบ. ${selCount} รายการ\nเบี้ยรวม: ${selTotalPremium.toLocaleString()} บาท\nค่าคอม: ${selCommission.toLocaleString()} บาท\nเลขที่ใบ: ${docNo}`)) return;
    setSaving(true);
    setMessage("");
    try {
      await post({
        action: "save_insurance_billing",
        insurance_ids: selectedRows.map(r => r.insurance_id),
        billing_doc_no: docNo,
        billed_by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ บันทึกใบวางบิล ${docNo} สำเร็จ ${selCount} รายการ`);
      fetchData();
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  async function cancelBilling(billingDocNo) {
    if (!billingDocNo) return;
    if (!window.confirm(`ยกเลิกใบวางบิล ${billingDocNo}?\nรายการในใบนี้จะกลับเป็น "ยังไม่วางบิล"`)) return;
    try {
      await post({ action: "cancel_insurance_billing", billing_doc_no: billingDocNo });
      setMessage(`✅ ยกเลิกใบวางบิล ${billingDocNo} แล้ว`);
      fetchData();
    } catch {
      setMessage("❌ ยกเลิกไม่สำเร็จ");
    }
  }

  function printBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อนพิมพ์"); return; }
    const html = buildBillingHTML({ rows: selectedRows, totalPremium: selTotalPremium, commission: selCommission, remit: selRemit });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
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

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🛡️ วางบิล งานพรบ.</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่ทำสัญญา:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <input type="text" placeholder="🔍 ค้นหา (กรมธรรม์, ผู้เอาประกัน, เลขถัง, ใบวางบิล)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showBilled} onChange={e => setShowBilled(e.target.checked)} />
          แสดงที่วางบิลแล้ว
        </label>

        {showBilled && (
          <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
            <button onClick={() => setViewMode("detail")}
              style={{ padding: "5px 12px", background: viewMode === "detail" ? "#072d6b" : "#e5e7eb", color: viewMode === "detail" ? "#fff" : "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              📋 ทุกรายการ
            </button>
            <button onClick={() => setViewMode("summary")}
              style={{ padding: "5px 12px", background: viewMode === "summary" ? "#072d6b" : "#e5e7eb", color: viewMode === "summary" ? "#fff" : "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              📊 สรุปต่อใบ
            </button>
          </div>
        )}
      </div>

      {/* Summary + Action */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 13 }}>
          <strong>เลือก {selCount} รายการ</strong> · เบี้ย {fmtNum(selPremium)} · เบี้ยรวม <span style={{ color: "#dc2626", fontWeight: 700 }}>{fmtNum(selTotalPremium)}</span> · ค่าคอม {fmtNum(selCommission)} · เบี้ยนำส่ง <span style={{ color: "#0369a1", fontWeight: 700 }}>{fmtNum(selRemit)}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={printBilling} disabled={selCount === 0}
          style={{ padding: "8px 18px", background: selCount === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 8, cursor: selCount === 0 ? "not-allowed" : "pointer", fontWeight: 600 }}>
          🖨️ พิมพ์ใบวางบิล
        </button>
        <button onClick={saveBilling} disabled={selCount === 0 || saving}
          style={{ padding: "8px 18px", background: selCount === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: (selCount === 0 || saving) ? "not-allowed" : "pointer", fontWeight: 600 }}>
          💾 {saving ? "กำลังบันทึก..." : "บันทึกวางบิล"}
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
            {showBilled ? "ไม่มีรายการที่วางบิลแล้ว" : "ไม่มีรายการ พรบ. รอวางบิล"}
          </div>
        ) : showBilled && viewMode === "summary" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>เลขที่ใบวางบิล</th>
                <th style={th}>วันที่วางบิล</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}>จำนวน</th>
                <th style={th}>เบี้ย</th>
                <th style={th}>เบี้ยรวม</th>
                <th style={th}>ค่าคอม</th>
                <th style={th}>เบี้ยนำส่ง</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {groupedByBill.map(g => (
                <tr key={g.billing_doc_no || "x"} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{g.billing_doc_no || "-"}</td>
                  <td style={td}>{fmtDate(g.billed_at)}</td>
                  <td style={td}>{g.billed_by || "-"}</td>
                  <td style={{ ...tdNum, fontWeight: 600 }}>{g.count}</td>
                  <td style={tdNum}>{fmtNum(g.premium)}</td>
                  <td style={{ ...tdNum, color: "#dc2626", fontWeight: 700 }}>{fmtNum(g.total_premium)}</td>
                  <td style={tdNum}>{fmtNum(g.commission)}</td>
                  <td style={{ ...tdNum, color: "#0369a1", fontWeight: 700 }}>{fmtNum(g.premium_remit)}</td>
                  <td style={td}>
                    {g.billing_doc_no && (
                      <>
                        <button onClick={() => setDetailRow(g)} title="ดูรายการในใบนี้"
                          style={{ padding: "3px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>📋 ดู</button>
                        <button onClick={() => cancelBilling(g.billing_doc_no)} title="ยกเลิกใบวางบิล"
                          style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑️ ยกเลิก</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {/* Grand total */}
              <tr style={{ borderTop: "2px solid #072d6b", background: "#f1f5f9", fontWeight: 700 }}>
                <td style={{ ...td, fontWeight: 700 }} colSpan={3}>รวม {groupedByBill.length} ใบ</td>
                <td style={tdNum}>{groupedByBill.reduce((s, g) => s + g.count, 0)}</td>
                <td style={tdNum}>{fmtNum(groupedByBill.reduce((s, g) => s + g.premium, 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(groupedByBill.reduce((s, g) => s + g.total_premium, 0))}</td>
                <td style={tdNum}>{fmtNum(groupedByBill.reduce((s, g) => s + g.commission, 0))}</td>
                <td style={{ ...tdNum, color: "#0369a1" }}>{fmtNum(groupedByBill.reduce((s, g) => s + g.premium_remit, 0))}</td>
                <td style={td}></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.insurance_id])} onChange={toggleAll} /></th>
                <th style={th}>วันที่ทำสัญญา</th>
                <th style={th}>เลขกรมธรรม์</th>
                <th style={th}>ผู้เอาประกัน</th>
                <th style={th}>เลขตัวถัง</th>
                <th style={th}>เลขทะเบียน</th>
                <th style={th}>เลขที่ใบขาย</th>
                <th style={th}>เลขที่รับเรื่อง</th>
                <th style={th}>รายการเบิก</th>
                <th style={{ ...th, textAlign: "right" }}>รับชำระ</th>
                <th style={th}>ค่าเบี้ย</th>
                {showBilled && <th style={th}>ใบวางบิล</th>}
                {showBilled && <th style={th}>วันที่วางบิล</th>}
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                // Highlight เหลืองถ้ามี receipt_no แต่ยังไม่มีรายการเบิก (ต้องตรวจ/เลือกรายการ)
                let claimed = [];
                try { claimed = Array.isArray(r.claimed_items) ? r.claimed_items : (typeof r.claimed_items === "string" ? JSON.parse(r.claimed_items) : []); } catch {}
                const needAttention = r.receipt_no && claimed.length === 0;
                const rowBg = selected[r.insurance_id] ? "#fef9c3"
                  : needAttention ? "#fef3c7"
                  : "transparent";
                return (
                <tr key={r.insurance_id} style={{ borderTop: "1px solid #e5e7eb", background: rowBg }}>
                  <td style={td}><input type="checkbox" checked={!!selected[r.insurance_id]} onChange={() => toggleOne(r.insurance_id)} /></td>
                  <td style={td}>{fmtDate(r.contract_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.policy_no || "-"}</td>
                  <td style={td}>{r.insured_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
                  <td style={td}>{r.plate_number || "-"}</td>
                  <td style={{ ...td, color: r.invoice_no ? "#065f46" : "#9ca3af", fontWeight: r.invoice_no ? 600 : 400 }}>{r.invoice_no || "-"}</td>
                  <td style={td}>
                    {r.receipt_no ? (
                      <button onClick={() => setClaimDialog(r)}
                        title="เลือกรายการเบิกจากใบรับเรื่อง"
                        style={{ padding: "2px 8px", background: "transparent", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                        {r.receipt_no} ▼
                      </button>
                    ) : <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td style={{ ...td, fontSize: 11 }}>
                    {(() => {
                      let claimed = [];
                      try { claimed = Array.isArray(r.claimed_items) ? r.claimed_items : (typeof r.claimed_items === "string" ? JSON.parse(r.claimed_items) : []); } catch {}
                      if (!claimed.length) return <span style={{ color: "#9ca3af" }}>-</span>;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {r.auto_matched && (
                            <span style={{ display: "inline-block", padding: "1px 6px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 9, fontWeight: 600, alignSelf: "flex-start" }}>🔗 Auto</span>
                          )}
                          {claimed.map((c, i) => <span key={i} style={{ color: "#374151" }}>• {c.income_name || c.description}</span>)}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ ...tdNum, color: "#0369a1", fontWeight: 700 }}>{r.amount_received ? fmtNum(r.amount_received) : "-"}</td>
                  <td style={{ ...tdNum, color: "#dc2626", fontWeight: 600 }}>{fmtNum(r.total_premium)}</td>
                  {showBilled && <td style={{ ...td, fontFamily: "monospace", color: "#059669" }}>{r.billing_doc_no || "-"}</td>}
                  {showBilled && <td style={td}>{r.billed_at ? new Date(r.billed_at).toLocaleString("th-TH") : "-"}</td>}
                  <td style={td}>
                    <button onClick={() => setDetailRow(r)}
                      style={{ padding: "3px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                      ดู
                    </button>
                    {showBilled && r.billing_doc_no && (
                      <button onClick={() => cancelBilling(r.billing_doc_no)}
                        style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginLeft: 4 }}>
                        ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} รายการ</td>
                <td style={{ ...tdNum, color: "#0369a1" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.amount_received || 0), 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.total_premium || 0), 0))}</td>
                {showBilled && <td colSpan={2}></td>}
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Detail popup */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>📋 รายละเอียด พรบ.</h3>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {[
                  ["วันที่ทำสัญญา", fmtDate(detailRow.contract_date)],
                  ["เลขกรมธรรม์", detailRow.policy_no],
                  ["ผู้เอาประกัน", detailRow.insured_name],
                  ["เลขตัวถัง", detailRow.chassis_no],
                  ["เลขทะเบียน", detailRow.plate_number],
                  ["เริ่ม–สิ้นสุด", `${fmtDate(detailRow.coverage_start)} → ${fmtDate(detailRow.coverage_end)}`],
                  ["ชำระ", detailRow.paid],
                  ["เบี้ย", fmtNum(detailRow.premium)],
                  ["อากร", fmtNum(detailRow.stamp_duty)],
                  ["ภาษี", fmtNum(detailRow.tax)],
                  ["เบี้ยรวม", fmtNum(detailRow.total_premium)],
                  ["ค่าคอม", fmtNum(detailRow.commission)],
                  ["เบี้ยนำส่ง", fmtNum(detailRow.premium_remit)],
                  ["ใบวางบิล", detailRow.billing_doc_no || "-"],
                  ["วันที่วางบิล", detailRow.billed_at ? new Date(detailRow.billed_at).toLocaleString("th-TH") : "-"],
                ].map(([k, v]) => (
                  <tr key={k}><td style={{ padding: "5px 8px", color: "#6b7280", width: 130 }}>{k}</td><td style={{ padding: "5px 8px", fontWeight: 600 }}>{v || "-"}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setDetailRow(null)} style={{ padding: "8px 16px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {claimDialog && (
        <ClaimItemsDialog
          insurance={claimDialog}
          onClose={() => setClaimDialog(null)}
          onSaved={() => { setClaimDialog(null); setMessage("✅ บันทึกรายการเบิกสำเร็จ"); fetchData(); }}
        />
      )}
    </div>
  );
}

function ClaimItemsDialog({ insurance, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_receipt_lines", keyword: insurance.receipt_no, include_submitted: true, bypass_insurance_filter: true }),
        });
        const data = await res.json();
        if (cancelled) return;
        // กรองเฉพาะรายการ พรบ./ประกัน ของใบรับเรื่องนี้เท่านั้น
        const isInsurance = (l) => {
          const t = String(l.income_type || "").toLowerCase();
          const n = String(l.income_name || "").toLowerCase();
          return t.includes("ประกัน") || t.includes("พรบ") || t.includes("พ.ร.บ") ||
                 n.includes("ประกัน") || n.includes("พรบ") || n.includes("พ.ร.บ");
        };
        const lines = (Array.isArray(data) ? data : [])
          .filter(l => l.receipt_no === insurance.receipt_no)
          .filter(isInsurance);
        setItems(lines);

        // pre-select existing claimed
        let claimed = [];
        try { claimed = Array.isArray(insurance.claimed_items) ? insurance.claimed_items : (typeof insurance.claimed_items === "string" ? JSON.parse(insurance.claimed_items) : []); } catch {}
        const sel = {};
        claimed.forEach(c => { if (c.line_id) sel[c.line_id] = true; });
        setSelected(sel);
      } catch (e) { setError("โหลดรายการไม่สำเร็จ"); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [insurance.receipt_no]);

  const fmtNum = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const selectedItems = items.filter(it => selected[it.line_id]);
  const selTotal = selectedItems.reduce((s, x) => s + Number(x.net_price || 0), 0);

  function toggle(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (items.every(it => selected[it.line_id])) {
      setSelected({});
    } else {
      const next = {};
      items.forEach(it => { next[it.line_id] = true; });
      setSelected(next);
    }
  }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const claimed = selectedItems.map(it => ({
        line_id: it.line_id,
        receipt_no: it.receipt_no,
        income_type: it.income_type,
        income_name: it.income_name,
        description: it.description,
        net_price: Number(it.net_price || 0),
      }));
      const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_insurance_claim",
          insurance_id: insurance.insurance_id,
          claimed_items: claimed,
          amount_received: selTotal,  // ใช้ยอดรวมจากรายการที่เลือกอัตโนมัติ
        }),
      });
      if (!res.ok) throw new Error("save fail");
      onSaved();
    } catch (e) { setError("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 800, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 12px", color: "#0891b2" }}>📋 เลือกรายการเบิก: <code>{insurance.receipt_no}</code></h3>
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          กรมธรรม์: <code>{insurance.policy_no}</code> · ผู้เอาประกัน: {insurance.insured_name} · เบี้ย: <strong style={{ color: "#dc2626" }}>{fmtNum(insurance.total_premium)}</strong>
        </div>

        {error && <div style={{ padding: 8, background: "#fee2e2", color: "#991b1b", borderRadius: 6, marginBottom: 10 }}>{error}</div>}

        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div> : items.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการสำหรับใบรับเรื่องนี้</div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f3f4f6" }}>
                <tr>
                  <th style={{ width: 30, padding: "6px 8px" }}>
                    <input type="checkbox" checked={items.length > 0 && items.every(it => selected[it.line_id])} onChange={toggleAll} />
                  </th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>ประเภทรายได้</th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>ชื่อรายได้</th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>รายละเอียด</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>ยอด</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.line_id} style={{ borderTop: "1px solid #e5e7eb", background: selected[it.line_id] ? "#fef9c3" : "transparent", cursor: "pointer" }} onClick={() => toggle(it.line_id)}>
                    <td style={{ padding: "6px 8px" }}><input type="checkbox" checked={!!selected[it.line_id]} onChange={() => toggle(it.line_id)} /></td>
                    <td style={{ padding: "6px 10px" }}>{it.income_type || "-"}</td>
                    <td style={{ padding: "6px 10px" }}>{it.income_name || "-"}</td>
                    <td style={{ padding: "6px 10px", fontSize: 11, color: "#6b7280" }}>{it.description || "-"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtNum(it.net_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#fef3c7", fontWeight: 700 }}>
                <tr>
                  <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right" }}>เลือก {selectedItems.length} รายการ · รวม</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#dc2626" }}>{fmtNum(selTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14, padding: "10px 14px", background: "#dcfce7", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#065f46" }}>
          💰 จำนวนเงินที่รับชำระ: <span style={{ fontSize: 16, fontWeight: 700 }}>{fmtNum(selTotal)}</span> บาท
          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 10, fontWeight: 400 }}>(คำนวณอัตโนมัติจากรายการที่เลือก)</span>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const tdNum = { padding: "8px", fontSize: 12, textAlign: "right", fontFamily: "monospace" };

function buildBillingHTML({ rows, totalPremium, commission, remit }) {
  const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const fmtNum = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = v => { if (!v) return "-"; const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`; };
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear() + 543}`;
  const trs = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fmtDate(r.contract_date)}</td><td>${safe(r.policy_no)}</td><td>${safe(r.insured_name)}</td><td class="mono">${safe(r.chassis_no)}</td><td>${safe(r.plate_number)}</td><td class="num">${fmtNum(r.total_premium)}</td><td class="num">${fmtNum(r.commission)}</td><td class="num">${fmtNum(r.premium_remit)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบวางบิลพรบ.</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; }
.head { text-align: center; margin-bottom: 14px; font-size: 10pt; color: #444; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #333; padding: 4px 6px; font-size: 10pt; }
th { background: #f0f4f9; }
.num { text-align: right; font-family: monospace; }
.mono { font-family: monospace; }
.total { font-weight: 700; background: #fef9c3; }
.sign-box { display: inline-block; width: 45%; margin-top: 40px; padding: 0 10px; vertical-align: top; }
.sign-line { margin-bottom: 6px; }
</style></head><body>
<h1>ใบวางบิล พรบ. รถใหม่</h1>
<div class="head">วันที่: ${dateStr} · จำนวน ${rows.length} รายการ</div>
<table>
<thead><tr><th>#</th><th>วันที่ทำสัญญา</th><th>กรมธรรม์</th><th>ผู้เอาประกัน</th><th>เลขตัวถัง</th><th>ทะเบียน</th><th>เบี้ยรวม</th><th>ค่าคอม</th><th>เบี้ยนำส่ง</th></tr></thead>
<tbody>${trs}
<tr class="total"><td colspan="6" style="text-align:right">รวมทั้งสิ้น</td><td class="num">${fmtNum(totalPremium)}</td><td class="num">${fmtNum(commission)}</td><td class="num">${fmtNum(remit)}</td></tr>
</tbody></table>
<div style="margin-top: 30px;">
  <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้วางบิล</div></div>
  <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้รับวางบิล</div></div>
</div>
</body></html>`;
}
