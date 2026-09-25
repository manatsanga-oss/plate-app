import React, { useState } from "react";
import { cancelPettyWithdrawal } from "../lib/pettyWithdraw";

// ตารางรายการเบิกเงินสดย่อยที่บันทึกแล้ว (ใต้ตารางใบ) — ใช้ร่วมกันหน้าค่าไปรษณีย์ / ค่าใช้จ่ายทั่วไป (user 2026-09-25)
const fmt = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
const thDate = (v) => (v ? new Date(String(v).slice(0, 10)).toLocaleDateString("th-TH") : "-");

export default function PettyWithdrawalPanel({ withdrawals, currentUser, isAdmin, onChanged, onReprint }) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(null);
  const rows = (withdrawals || []).slice(0, 100);
  const active = rows.filter((w) => w.status !== "cancelled");
  const sum = active.reduce((s, w) => s + (Number(w.total_amount) || 0), 0);
  async function cancel(w) {
    if (!window.confirm(`ยกเลิกใบเบิก ${w.withdraw_no} ยอด ${fmt(w.total_amount)} บาท?\nยอดหักในสรุปรายวันรับเงินวันที่ ${thDate(w.withdraw_date)} จะหายไป และเลือกใบเหล่านี้มาเบิกใหม่ได้`)) return;
    setBusy(w.id);
    try { await cancelPettyWithdrawal(w.id, currentUser); onChanged?.(); } catch (e) { alert(e.message || "ยกเลิกไม่สำเร็จ"); }
    setBusy(null);
  }
  return (
    <div style={{ marginTop: 18, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => setOpen((o) => !o)} style={{ padding: "8px 14px", background: "#f3f4f6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
        <span style={{ fontWeight: 700, color: "#072d6b" }}>💰 รายการเบิกเงินสดย่อยที่บันทึกแล้ว ({active.length} ใบ · รวม {fmt(sum)} บาท) — หักเงินสดในสรุปรายวันรับเงิน ณ วันที่กดบันทึก</span>
        <span style={{ color: "#6b7280" }}>{open ? "▲ ซ่อน" : "▼ แสดง"}</span>
      </div>
      {open && (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead><tr><th>#</th><th>เลขที่เบิก</th><th>วันที่เบิก (วันหัก)</th><th>สาขา</th><th>ใบที่รวม</th><th>ยอดรวม</th><th>ผู้บันทึก</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 14, color: "#9ca3af" }}>ยังไม่มีรายการเบิก</td></tr> :
                rows.map((w, i) => (
                  <tr key={w.id} style={{ opacity: w.status === "cancelled" ? 0.55 : 1 }}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{w.withdraw_no}</td>
                    <td>{thDate(w.withdraw_date)}</td>
                    <td style={{ color: "#0369a1", fontWeight: 600 }}>{w.branch_name || w.branch_code || "-"}</td>
                    <td style={{ maxWidth: 320, whiteSpace: "normal" }}>{String(w.doc_nos || "").split(",").filter(Boolean).join(", ")} <span style={{ color: "#6b7280" }}>({w.doc_count} ใบ)</span></td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmt(w.total_amount)}</td>
                    <td>{w.created_by || "-"}</td>
                    <td>{w.status === "cancelled"
                      ? <span style={{ padding: "2px 8px", borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontSize: 11 }}>ยกเลิกแล้ว{w.cancelled_by ? ` · ${w.cancelled_by}` : ""}</span>
                      : <span style={{ padding: "2px 8px", borderRadius: 12, background: "#d1fae5", color: "#065f46", fontSize: 11 }}>หักเงินสดแล้ว</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {w.status !== "cancelled" && onReprint && <button onClick={() => onReprint(w)} style={{ padding: "3px 10px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>🖨️ พิมพ์ซ้ำ</button>}
                      {w.status !== "cancelled" && isAdmin && <button disabled={busy === w.id} onClick={() => cancel(w)} style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>ยกเลิก</button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
