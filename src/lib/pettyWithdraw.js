// เบิกเงินสดย่อย (ค่าไปรษณีย์ / ค่าใช้จ่ายทั่วไป) — บันทึกตอนกด "บันทึกเบิกเงินสดย่อย + พิมพ์ใบแทนใบเสร็จ"
// ยอดรวมค่าใช้จ่ายของใบที่เลือกเป็นยอดหักเงินสดในสรุปรายวันรับเงิน ณ วันที่กด (user 2026-09-25)
// ตัวใบ POST-/GEN- เองไม่หักเงินสดหน้าร้าน (เบิกจากเงินสดย่อย) — ดู lib/dailyCash.js
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api";
const post = async (body) => {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  if (!t) return null; // n8n ยังไม่มี action (workflow ยังไม่ re-import)
  try { return JSON.parse(t); } catch { return null; }
};
const pad = (n) => String(n).padStart(2, "0");
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export async function listPettyWithdrawals(params = {}) {
  const d = await post({ action: "list_petty_withdrawals", ...params });
  return Array.isArray(d) ? d : [];
}

/** map doc_id (string) → withdrawal ที่ยัง active (ไว้โชว์ป้าย "เบิกแล้ว" และกันเบิกซ้ำ) */
export function withdrawnDocMap(withdrawals) {
  const m = new Map();
  (withdrawals || []).filter((w) => w && w.status !== "cancelled").forEach((w) => {
    String(w.doc_ids || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((id) => { if (!m.has(id)) m.set(id, w); });
  });
  return m;
}

/** บันทึกเบิกเงินสดย่อยจากใบที่เลือก (ใบเดียวกันต้องสาขา/บริษัทเดียวกัน — ใช้ของใบแรก) */
export async function savePettyWithdrawal({ pettyType, docs, currentUser, note = "" }) {
  const sel = (docs || []).filter(Boolean);
  if (!sel.length) throw new Error("ยังไม่ได้เลือกใบ");
  const total = sel.reduce((s, d) => s + (Number(d.total_amount) || 0), 0);
  const first = sel[0];
  const d = new Date();
  const withdraw_no = `PCW${String(d.getFullYear() + 543).slice(-2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const branch_name = first.branch_name || first.branch_code || currentUser?.branch || "";
  const res = await post({
    action: "save_petty_withdrawal", withdraw_no, withdraw_date: todayIso(), petty_type: pettyType,
    branch_code: String(first.branch_code || branch_name || "").split(" ")[0], branch_name,
    company_name: first.company_name || "", total_amount: Math.round(total * 100) / 100,
    doc_ids: sel.map((x) => String(x.id)), doc_nos: sel.map((x) => x.doc_no), note,
    created_by: currentUser?.name || currentUser?.username || "",
  });
  if (!res || res.success !== true) throw new Error(res?.error || "n8n ยังไม่มี action save_petty_withdrawal (ต้อง re-import Petty_Cash_API (6).json)");
  return { ...res, withdraw_no: res.withdraw_no || withdraw_no, total };
}

export async function cancelPettyWithdrawal(id, currentUser) {
  const res = await post({ action: "cancel_petty_withdrawal", id, cancelled_by: currentUser?.name || currentUser?.username || "" });
  if (!res || res.success !== true) throw new Error(res?.error || "ยกเลิกไม่สำเร็จ");
  return res;
}
