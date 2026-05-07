import React, { useEffect, useState } from "react";

const HR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

function fmtN(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function monthDisplay(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d).slice(0, 7);
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}

export default function HrPayrollPaymentPage({ currentUser }) {
  const [tab, setTab] = useState("created");
  const [created, setCreated] = useState([]);
  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // detail popup
  const [detail, setDetail] = useState(null); // { item, docs[] }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [monthFilter]);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const body = { action: "payroll_payables", mode: "list_created" };
      if (monthFilter) body.month_year = monthFilter + "-01";
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setCreated(Array.isArray(data) ? data : []);
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ: " + e.message); }
    setLoading(false);
  }

  async function openDetail(item) {
    setDetail({ item, docs: [], loading: true });
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group: item.save_group }),
      });
      const data = await res.json();
      setDetail({ item, docs: Array.isArray(data) ? data : [], loading: false });
    } catch (e) {
      setDetail({ item, docs: [], loading: false, error: e.message });
    }
  }

  async function cancelAll(item) {
    if (!window.confirm(`ยกเลิกการตั้งจ่ายทั้งหมดของเดือน ${monthDisplay(item.month_year)}?\n\n⚠️ จะลบเอกสารที่ยังเป็น draft/cancelled ทั้งหมด\nเอกสารที่จ่ายแล้ว (paid) จะคงอยู่ — ถ้ามี การยกเลิกจะล้มเหลว`)) return;
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_payables", mode: "cancel_all", save_group: item.save_group }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      if (arr[0]?.error) { alert("❌ " + arr[0].error); return; }
      setMessage(`✅ ยกเลิกแล้ว ${arr[0]?.deleted_count || 0} เอกสาร`);
      setDetail(null);
      fetchData();
    } catch (e) { alert("❌ " + e.message); }
  }

  const creditorLabel = { salary: "เงินเดือนพนักงาน", sso: "ประกันสังคม", tax: "สรรพากร", pf: "กองทุนสำรองฯ", loan: "กยศ." };
  const statusLabel = { draft: "🟡 รอจ่าย", paid: "🟢 จ่ายแล้ว", cancelled: "🔴 ยกเลิก" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💼 บันทึกการจ่ายเงินเดือน</h2>
      </div>

      {message && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <div style={{ color: "#072d6b", fontSize: 14, fontWeight: 700 }}>💼 รายการตั้งจ่าย</div>
        <span style={{ fontSize: 12, color: "#6b7280" }}>(ตั้งจ่ายใหม่ที่หน้า "คำนวณเงินเดือน")</span>
        <span style={{ marginLeft: 14, fontSize: 13, fontWeight: 600 }}>กรองเดือน:</span>
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
        {monthFilter && (
          <button onClick={() => setMonthFilter("")} style={{ padding: "5px 10px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            ✕ ล้าง
          </button>
        )}
        <div style={{ marginLeft: "auto" }}>
          <button onClick={fetchData} disabled={loading}
            style={{ padding: "6px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* CREATED LIST */}
      {true && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          {loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
          : created.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีการตั้งจ่าย</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>เดือน</th>
                  <th style={th}>วันที่บันทึก</th>
                  <th style={th}>ผู้บันทึก</th>
                  <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                  <th style={{ ...th, textAlign: "right" }}>คน</th>
                  <th style={{ ...th, textAlign: "right" }}>🟡 รอจ่าย</th>
                  <th style={{ ...th, textAlign: "right" }}>🟢 จ่ายแล้ว</th>
                  <th style={{ ...th, textAlign: "right" }}>🔴 ยกเลิก</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                  <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {created.map(it => {
                  const allPending = Number(it.draft_count || 0) > 0 && Number(it.paid_count || 0) === 0;
                  const allPaid = Number(it.paid_count || 0) > 0 && Number(it.draft_count || 0) === 0;
                  const overall = allPaid ? "🟢 จ่ายแล้ว" : allPending ? "🟡 รอจ่าย" : "🟠 จ่ายบางส่วน";
                  return (
                    <tr key={it.save_group} style={{ borderTop: "1px solid #e5e7eb", background: it.is_locked ? "#fef2f2" : undefined }}>
                      <td style={{ ...td, fontWeight: 700, color: "#072d6b" }}>{monthDisplay(it.month_year)}</td>
                      <td style={{ ...td, fontSize: 11 }}>{it.saved_at ? new Date(it.saved_at).toLocaleString("th-TH") : "-"}</td>
                      <td style={td}>{it.saved_by || "-"}</td>
                      <td style={{ ...td, textAlign: "center", fontSize: 11 }}>
                        <div>{overall}</div>
                        {it.is_locked && <div style={{ marginTop: 2, padding: "1px 6px", background: "#dc2626", color: "#fff", borderRadius: 8, fontSize: 10, display: "inline-block" }}>🔒 ล็อก</div>}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{it.employee_count}</td>
                      <td style={{ ...td, textAlign: "right", color: "#f59e0b", fontWeight: 600 }}>{it.draft_count}</td>
                      <td style={{ ...td, textAlign: "right", color: "#10b981", fontWeight: 600 }}>{it.paid_count}</td>
                      <td style={{ ...td, textAlign: "right", color: "#ef4444" }}>{it.cancelled_count}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#7c3aed" }}>{fmtN(it.total_amount)}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button onClick={() => openDetail(it)}
                          style={{ padding: "5px 12px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                          👁️ ดู
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* DETAIL POPUP */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 900, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 รายการเอกสารเจ้าหนี้ {monthDisplay(detail.item.month_year)}</h3>
              <button onClick={() => cancelAll(detail.item)} disabled={detail.item.paid_count > 0 || detail.item.is_locked}
                title={detail.item.is_locked ? "snapshot ถูกล็อก ยกเลิกไม่ได้" : detail.item.paid_count > 0 ? "มีเอกสารที่จ่ายแล้ว ยกเลิกทั้งหมดไม่ได้" : "ยกเลิกการตั้งจ่ายทั้งหมด"}
                style={{ padding: "6px 14px", background: (detail.item.paid_count > 0 || detail.item.is_locked) ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: (detail.item.paid_count > 0 || detail.item.is_locked) ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                🗑️ ยกเลิกทั้งหมด
              </button>
            </div>
            {detail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div>
            : detail.docs.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีเอกสาร</div>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 12 }}>
                <thead style={{ background: "#f3f4f6" }}>
                  <tr>
                    <th style={th2}>เลขที่</th>
                    <th style={th2}>ประเภท</th>
                    <th style={th2}>เจ้าหนี้</th>
                    <th style={th2}>รายละเอียด</th>
                    <th style={{ ...th2, textAlign: "right" }}>ยอด</th>
                    <th style={th2}>บัญชีจ่าย</th>
                    <th style={th2}>สถานะ</th>
                    <th style={th2}>เลขจ่าย</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.docs.map(d => (
                    <tr key={d.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...td2, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{d.expense_doc_no}</td>
                      <td style={td2}>{creditorLabel[d.payroll_creditor_type] || d.payroll_creditor_type}</td>
                      <td style={td2}>{d.vendor_name}</td>
                      <td style={{ ...td2, fontSize: 11, color: "#6b7280" }}>{d.description}</td>
                      <td style={{ ...td2, textAlign: "right", fontWeight: 700 }}>{fmtN(d.total)}</td>
                      <td style={{ ...td2, fontSize: 11 }}>
                        {d.from_bank_account_id ? <><strong>{d.bank_name}</strong> {d.account_no}</> : <span style={{ color: "#dc2626" }}>—</span>}
                      </td>
                      <td style={td2}>{statusLabel[d.status] || d.status}</td>
                      <td style={{ ...td2, fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{d.paid_doc_no || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14, padding: "8px 12px", background: "#eff6ff", color: "#1e40af", borderRadius: 6, fontSize: 12 }}>
              💡 บันทึกตัดบัญชี (จ่ายเงินจริง) ทำที่หน้า <strong>"บันทึกค่าใช้จ่าย"</strong> (กลุ่ม Accounting) — เอกสารเหล่านี้จะอยู่ในรายการ status = draft
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setDetail(null)} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "8px", whiteSpace: "nowrap" };
const th2 = { padding: "8px 6px", textAlign: "left", whiteSpace: "nowrap", fontWeight: 700, color: "#374151" };
const td2 = { padding: "6px 6px", whiteSpace: "nowrap" };
