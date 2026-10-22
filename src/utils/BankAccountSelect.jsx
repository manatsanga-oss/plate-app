import React, { useEffect, useState } from "react";

// dropdown เลือกบัญชีธนาคาร (จาก accounting-api list_bank_accounts) — ใช้ตอนคืนเงินแบบ "เงินโอน" ให้รู้ว่าโอนออกจากบัญชีไหน
// เพื่อให้รายการไปขึ้นในรายงานเคลื่อนไหวบัญชี (user 2026-10-22) · ตัดบัญชีเงินสดย่อย/ลูกหนี้ออก เหลือบัญชีธนาคารจริง
// value = account_id (string/number) · onChange(accountObj|null) ส่ง {account_id, account_name, bank_name, account_no}
const ACCOUNTING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
let cache = null; // โหลดครั้งเดียวต่อหน้า

export async function loadBankAccounts() {
  if (cache) return cache;
  try {
    const res = await fetch(ACCOUNTING_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) });
    const d = await res.json().catch(() => []);
    const arr = Array.isArray(d) ? d : (d && d.data) || [];
    cache = arr.filter((a) => a && a.account_id && !/เงินสดย่อย|ลูกหนี้/.test(String(a.account_type || "")));
  } catch { cache = []; }
  return cache;
}

export function bankAccountLabel(a) {
  if (!a) return "";
  const bank = String(a.bank_name || "").trim();
  return `${a.account_name}${bank && bank !== "-" ? ` · ${bank}` : ""}${a.account_no ? ` ${a.account_no}` : ""}`;
}

export default function BankAccountSelect({ value, onChange, style, required = true, placeholder = "-- เลือกบัญชีที่โอนออก --" }) {
  const [list, setList] = useState(cache || []);
  useEffect(() => { let alive = true; loadBankAccounts().then((l) => { if (alive) setList(l); }); return () => { alive = false; }; }, []);
  return (
    <select value={value == null ? "" : String(value)} required={required} style={style}
      onChange={(e) => { const id = e.target.value; onChange(list.find((a) => String(a.account_id) === id) || null); }}>
      <option value="">{placeholder}</option>
      {list.map((a) => <option key={a.account_id} value={String(a.account_id)}>{bankAccountLabel(a)}</option>)}
    </select>
  );
}
