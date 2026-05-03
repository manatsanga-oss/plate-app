import React, { useEffect, useMemo, useState } from "react";

const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const TAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

const BRANCH_OPTS = [
  { value: "PAPAO", label: "ป.เปา" },
  { value: "NAKORNLUANG", label: "นครหลวง" },
];

export default function FinancePaymentMatchPage({ currentUser }) {
  // tab: "match" = บันทึกใหม่ / "history" = ประวัติการตัด
  const [tab, setTab] = useState("match");
  const [historyTransfers, setHistoryTransfers] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState({});

  // step 1: finance company
  const [financeCompanies, setFinanceCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");

  // step 2: pending transfers
  const [transfers, setTransfers] = useState([]);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  // step 3: search tax invoices
  const [searchBranch, setSearchBranch] = useState("PAPAO");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // step 4-5: selected items
  const [selectedItems, setSelectedItems] = useState({}); // { "BRANCH|tax_invoice_no": amount }

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchFinanceCompanies();
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory();
    /* eslint-disable-next-line */
  }, [tab]);

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_finance_transfers", match_status: "matched" }),
      });
      const data = await res.json();
      setHistoryTransfers(Array.isArray(data) ? data : []);
    } catch { setHistoryTransfers([]); }
    setHistoryLoading(false);
  }

  async function cancelMatch(t) {
    if (!window.confirm(`ยกเลิกการตัดรับชำระ ${t.doc_no || `FT-${t.ft_id}`} ?\n• เงินโอนจะกลับเป็น "รอตัดรับชำระ"\n• ใบกำกับที่ตัดไปจะปลดล็อค (paid_from_ft_id = NULL)`)) return;
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_finance_payment_match", ft_id: t.ft_id }),
      });
      if (!res.ok) throw new Error("cancel fail");
      setMessage(`✅ ยกเลิกการตัดรับชำระสำเร็จ`);
      fetchHistory();
    } catch (e) {
      setMessage("❌ ยกเลิกไม่สำเร็จ: " + e.message);
    }
  }

  async function editMatch(t) {
    // ยกเลิก match → กลับไป tab match พร้อม pre-select transfer
    if (!window.confirm(`แก้ไขการตัดรับ ${t.doc_no || `FT-${t.ft_id}`} ?\n• ระบบจะยกเลิกการตัดเดิม\n• แล้วกลับไปหน้าบันทึกใหม่ ให้คุณเลือกรายการใหม่`)) return;
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_finance_payment_match", ft_id: t.ft_id }),
      });
      if (!res.ok) throw new Error("revert fail");
      setMessage(`✅ ยกเลิกการตัดเดิม — กรุณาตัดใหม่`);
      setTab("match");
      setSelectedCompany(t.finance_company);
      // จะ auto-select transfer เมื่อ fetchTransfers โหลดเสร็จ
      setTimeout(() => {
        setSelectedTransfer({ ft_id: t.ft_id, finance_company: t.finance_company, amount: t.amount, doc_no: t.doc_no, transfer_date: t.transfer_date, bank_name: t.bank_name, account_no: t.account_no });
      }, 800);
    } catch (e) {
      setMessage("❌ แก้ไขไม่สำเร็จ: " + e.message);
    }
  }

  useEffect(() => {
    if (selectedCompany) fetchTransfers();
    else setTransfers([]);
    setSelectedTransfer(null);
    setSelectedItems({});
    setSearchResults([]);
    /* eslint-disable-next-line */
  }, [selectedCompany]);

  // เมื่อเลือกเงินโอน → auto-load รายการทั้งหมดของไฟแนนท์นี้ (ที่ยังไม่ตัดรับ) จากทั้ง 2 สาขา
  useEffect(() => {
    if (selectedTransfer && selectedCompany) loadAllUnmatched();
    else setSearchResults([]);
    setSelectedItems({});
    /* eslint-disable-next-line */
  }, [selectedTransfer]);

  async function loadAllUnmatched() {
    setSearching(true);
    setMessage("");
    try {
      const branches = ["PAPAO", "NAKORNLUANG"];
      const results = [];
      const errors = [];
      // ตัดข้อความเหลือเฉพาะคำสำคัญ (กรณีสะกดต่างกันเล็กน้อย เช่น กรุ๊ปลีส vs กรุ๊ปลิส)
      const companyKey = (selectedCompany || "").trim();
      // ดึง keyword สั้นๆ — แค่ 4-5 ตัวอักษรแรก เพื่อหลีกเลี่ยงเรื่องการสะกด
      const shortKey = companyKey.replace(/^บริษัท\s*/, "").substring(0, 5);

      for (const branch of branches) {
        try {
          const res = await fetch(TAX_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "list_tax_invoices",
              branch,
              status: "active",
              // ไม่ส่ง search — โหลดทั้งหมดแล้ว filter ใน frontend
            }),
          });
          if (!res.ok) {
            errors.push(`${branch}: HTTP ${res.status}`);
            continue;
          }
          const text = await res.text();
          if (!text || !text.trim()) {
            errors.push(`${branch}: response ว่าง (workflow ยังไม่ active?)`);
            continue;
          }
          let data;
          try { data = JSON.parse(text); }
          catch { errors.push(`${branch}: invalid JSON`); continue; }
          const arr = Array.isArray(data) ? data : [];
          // กรอง: ยังไม่ตัดรับ + ไฟแนนท์ match แบบยืดหยุ่น
          // PAPAO/นครหลวง: customer_name = ไฟแนนท์
          // สิงห์ชัย (MIC): customer_name = NULL → ใช้ sale_finance_company จาก moto_sales JOIN
          const matched = arr.filter(r => {
            if (r.paid_from_ft_id) return false;
            const cust = String(r.customer_name || r.sale_finance_company || "").toLowerCase();
            if (!cust) return false;
            const target = companyKey.toLowerCase();
            const targetShort = shortKey.toLowerCase();
            return cust.includes(target) || cust.includes(targetShort) || target.includes(cust);
          });
          matched.forEach(r => results.push({ ...r, branch }));
        } catch (e) {
          errors.push(`${branch}: ${e.message}`);
        }
      }
      setSearchResults(results);
      if (errors.length > 0 && results.length === 0) {
        setMessage(`⚠️ ${errors.join(" | ")}`);
      } else if (errors.length > 0) {
        setMessage(`⚠️ บางสาขาโหลดไม่ได้: ${errors.join(" | ")} (ได้ ${results.length} รายการ)`);
      } else {
        setMessage(`✅ พบ ${results.length} รายการของ ${selectedCompany} ที่ยังไม่ตัดรับชำระ`);
      }
    } catch (e) {
      setMessage("❌ โหลดไม่สำเร็จ: " + e.message);
      setSearchResults([]);
    }
    setSearching(false);
  }

  async function fetchFinanceCompanies() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_finance_companies" }),
      });
      const data = await res.json();
      setFinanceCompanies(Array.isArray(data) ? data.filter(c => (c.status || "active") === "active") : []);
    } catch { setFinanceCompanies([]); }
  }

  async function fetchTransfers() {
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_finance_transfers", match_status: "pending" }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      // filter by selectedCompany
      setTransfers(arr.filter(t => t.finance_company === selectedCompany));
    } catch { setTransfers([]); }
  }

  // ใช้สำหรับ "filter" จาก list ที่โหลดแล้ว (ไม่เรียก API ใหม่)
  // หรือถ้าอยากค้นนอกจากชื่อไฟแนนท์ก็เรียก searchExtra
  async function searchExtra() {
    if (!searchKeyword.trim()) { loadAllUnmatched(); return; }
    setSearching(true);
    setMessage("");
    try {
      const res = await fetch(TAX_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_tax_invoices",
          branch: searchBranch,
          search: searchKeyword.trim(),
          status: "active",
        }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      const unmatched = arr.filter(r => !r.paid_from_ft_id);
      setSearchResults(unmatched.map(r => ({ ...r, branch: searchBranch })));
    } catch (e) {
      setMessage("❌ ค้นหาไม่สำเร็จ: " + e.message);
    }
    setSearching(false);
  }

  // กรองในรายการที่โหลดแล้ว (frontend filter)
  const displayedResults = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return searchResults;
    return searchResults.filter(r => {
      const hay = [r.tax_invoice_no, r.engine_no, r.chassis_no, r.customer_name, r.sale_customer_name, r.sale_finance_company, r.model_name, r.plate_number]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }, [searchResults, searchKeyword]);

  function toggleItem(r) {
    const key = `${r.branch}|${r.tax_invoice_no}`;
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[key] != null) delete next[key];
      else next[key] = Number(r.total_amount || 0); // default amount = ยอดรวม
      return next;
    });
  }

  function setItemAmount(key, value) {
    const v = Number(value);
    if (Number.isFinite(v)) {
      setSelectedItems(prev => ({ ...prev, [key]: v }));
    }
  }

  // คำนวณยอดสะสม + คงเหลือ
  const matchedTotal = Object.values(selectedItems).reduce((s, v) => s + Number(v || 0), 0);
  const transferAmount = Number(selectedTransfer?.amount || 0);
  const remaining = transferAmount - matchedTotal;
  const isComplete = selectedTransfer && Math.abs(remaining) < 0.01 && Object.keys(selectedItems).length > 0;

  async function saveMatch() {
    if (!selectedTransfer) { setMessage("⚠️ เลือกเงินโอนก่อน"); return; }
    if (!isComplete) { setMessage("⚠️ ยอดที่เลือกต้องเท่ากับยอดเงินโอน"); return; }
    setSaving(true);
    setMessage("");
    try {
      const items = Object.entries(selectedItems).map(([key, amount]) => {
        const [branch, tax_invoice_no] = key.split("|");
        const r = searchResults.find(x => x.branch === branch && x.tax_invoice_no === tax_invoice_no);
        return {
          branch,
          tax_invoice_no,
          amount: Number(amount),
          chassis_no: r?.chassis_no || null,
          engine_no: r?.engine_no || null,
          customer_name: r?.sale_customer_name || r?.customer_name || null,  // ลูกค้าจริงจาก moto_sales
          finance_company: r?.customer_name || r?.sale_finance_company || null,  // ไฟแนนท์ (tax invoice หรือ sales)
          plate_number: r?.plate_number || null,
        };
      });
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_finance_payment_match",
          ft_id: selectedTransfer.ft_id,
          items,
          matched_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      if (!res.ok) throw new Error("save fail HTTP " + res.status);
      const data = await res.json().catch(() => null);
      const result = Array.isArray(data) ? data[0] : data;
      // Validate ว่า finance_transfers ถูก update เป็น matched จริง
      if (result?.match_status !== 'matched') {
        throw new Error("workflow ไม่ได้ update finance_transfers (match_status=" + (result?.match_status || "unknown") + "). กรุณา re-import Accounting API.json ใน n8n");
      }
      setMessage(`✅ บันทึกการตัดรับชำระสำเร็จ — ${items.length} รายการ (FT-${result.ft_id})`);
      setSelectedTransfer(null);
      setSelectedItems({});
      setSearchResults([]);
      fetchTransfers();
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + e.message);
    }
    setSaving(false);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔗 บันทึกรับชำระเงินไฟแนนท์</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["match", "📝 บันทึกใหม่"],
          ["history", "📜 ประวัติการตัด"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : message.startsWith("❌") ? "#fee2e2" : "#fef3c7", color: message.startsWith("✅") ? "#065f46" : message.startsWith("❌") ? "#991b1b" : "#92400e" }}>
          {message}
        </div>
      )}

      {/* History view */}
      {tab === "history" && (
        <div style={card}>
          <div style={cardTitle}>📜 ประวัติการตัดรับชำระ ({historyTransfers.length} รายการ)</div>
          {historyLoading ? (
            <div style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังโหลด...</div>
          ) : historyTransfers.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ยังไม่มีประวัติการตัดรับชำระ</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {historyTransfers.map(t => {
                const items = Array.isArray(t.matched_items) ? t.matched_items : (t.matched_items ? (typeof t.matched_items === "string" ? JSON.parse(t.matched_items) : []) : []);
                const isOpen = !!historyExpanded[t.ft_id];
                return (
                  <div key={t.ft_id} style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(90deg,#065f46 0%,#10b981 100%)", color: "#fff", cursor: "pointer", flexWrap: "wrap" }}
                      onClick={() => setHistoryExpanded(p => ({ ...p, [t.ft_id]: !p[t.ft_id] }))}>
                      <span style={{ fontSize: 14 }}>{isOpen ? "▾" : "▸"}</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{t.doc_no || `FT-${t.ft_id}`}</span>
                      <span>{fmtDate(t.transfer_date)}</span>
                      <span style={{ flex: 1, fontSize: 12, opacity: 0.9 }}>{t.finance_company} · {t.bank_name}</span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>฿ {fmt(t.amount)}</span>
                      <span style={{ background: "#fff3", padding: "2px 10px", borderRadius: 4, fontSize: 11 }}>
                        ✅ ตัดแล้ว · {items.length} รายการ
                      </span>
                      <button onClick={e => { e.stopPropagation(); editMatch(t); }}
                        style={{ padding: "4px 10px", background: "#fff", color: "#7c3aed", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        ✏️ แก้ไข
                      </button>
                      <button onClick={e => { e.stopPropagation(); cancelMatch(t); }}
                        style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        🗑️ ยกเลิก
                      </button>
                    </div>
                    {isOpen && items.length > 0 && (
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead style={{ background: "#f3f4f6" }}>
                          <tr>
                            <th style={th}>#</th>
                            <th style={th}>สาขา</th>
                            <th style={th}>เลขใบกำกับ</th>
                            <th style={th}>ลูกค้า</th>
                            <th style={th}>เลขเครื่อง</th>
                            <th style={th}>เลขถัง</th>
                            <th style={th}>ทะเบียน</th>
                            <th style={{ ...th, textAlign: "right" }}>จำนวนที่ตัด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                              <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                              <td style={td}>
                                <span style={{ display: "inline-block", padding: "2px 8px", background: it.branch === "PAPAO" ? "#dbeafe" : "#fef3c7", color: it.branch === "PAPAO" ? "#1e40af" : "#92400e", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                  {it.branch === "PAPAO" ? "ป.เปา" : "นครหลวง"}
                                </span>
                              </td>
                              <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{it.tax_invoice_no}</td>
                              <td style={td}>{it.customer_name || "-"}</td>
                              <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{it.engine_no || "-"}</td>
                              <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{it.chassis_no || "-"}</td>
                              <td style={td}>{it.plate_number || "-"}</td>
                              <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#15803d" }}>{fmt(it.amount)}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: "2px solid #15803d", background: "#dcfce7", fontWeight: 700 }}>
                            <td colSpan={7} style={{ ...td, textAlign: "right" }}>รวม</td>
                            <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#15803d" }}>
                              {fmt(items.reduce((s, x) => s + Number(x.amount || 0), 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {isOpen && items.length === 0 && (
                      <div style={{ padding: 14, color: "#9ca3af", fontSize: 12 }}>ไม่มีข้อมูลรายการที่ตัด</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Match view (existing — show only when tab === 'match') */}
      {tab === "match" && (<>

      {/* Step 1: เลือกไฟแนนท์ */}
      <div style={card}>
        <div style={cardTitle}>1️⃣ เลือกไฟแนนท์</div>
        <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} style={{ ...inp, maxWidth: 500 }}>
          <option value="">-- เลือกไฟแนนท์ --</option>
          {financeCompanies.map(c => (
            <option key={c.id || c.company_name} value={c.company_name}>{c.company_name}</option>
          ))}
        </select>
      </div>

      {/* Step 2: เลือกเงินโอน (รอตัดรับชำระ) */}
      {selectedCompany && (
        <div style={card}>
          <div style={cardTitle}>2️⃣ เลือกเงินโอน (รอตัดรับชำระ — {transfers.length} รายการ)</div>
          {transfers.length === 0 ? (
            <div style={{ color: "#9ca3af", textAlign: "center", padding: 16 }}>ไม่มีเงินโอนรอตัดรับชำระสำหรับ {selectedCompany}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {transfers.map(t => {
                const isSel = selectedTransfer?.ft_id === t.ft_id;
                return (
                  <label key={t.ft_id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
                    border: "1px solid " + (isSel ? "#15803d" : "#e5e7eb"),
                    background: isSel ? "#f0fdf4" : "#fff",
                    cursor: "pointer",
                  }}>
                    <input type="radio" name="transfer" checked={isSel}
                      onChange={() => { setSelectedTransfer(t); setSelectedItems({}); }} />
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#072d6b", minWidth: 130 }}>{t.doc_no || `FT-${t.ft_id}`}</span>
                    <span style={{ minWidth: 90 }}>{fmtDate(t.transfer_date)}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "#6b7280" }}>{t.bank_name} · {t.account_no}</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#15803d", fontSize: 16 }}>฿ {fmt(t.amount)}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Filter (ใช้กรองในรายการที่โหลดมาแล้ว) */}
      {selectedTransfer && (
        <div style={card}>
          <div style={cardTitle}>3️⃣ กรองรายการ — เลขเครื่อง / เลขถัง / ใบกำกับ (ไม่บังคับ)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
              placeholder="🔍 พิมพ์เพื่อกรอง (auto-filter)"
              style={{ ...inp, flex: 1, minWidth: 240 }} />
            <button onClick={loadAllUnmatched} disabled={searching}
              style={{ padding: "8px 18px", background: searching ? "#9ca3af" : "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
              {searching ? "..." : "🔄 รีเฟรช"}
            </button>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              📋 รายการของ <strong>{selectedCompany}</strong> ที่ยังไม่ตัดรับ
            </span>
          </div>
        </div>
      )}

      {/* Step 4-5: ผลลัพธ์ + เลือก + ยอด */}
      {selectedTransfer && (searching || searchResults.length > 0) && (
        <div style={card}>
          <div style={cardTitle}>4️⃣ เลือกรายการ + ระบุจำนวนที่รับชำระ ({displayedResults.length} / {searchResults.length})</div>
          {searching && <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>กำลังโหลด...</div>}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}><input type="checkbox"
                    checked={displayedResults.length > 0 && displayedResults.every(r => selectedItems[`${r.branch}|${r.tax_invoice_no}`] != null)}
                    onChange={() => {
                      const allChecked = displayedResults.every(r => selectedItems[`${r.branch}|${r.tax_invoice_no}`] != null);
                      if (allChecked) setSelectedItems({});
                      else {
                        const next = { ...selectedItems };
                        displayedResults.forEach(r => { next[`${r.branch}|${r.tax_invoice_no}`] = Number(r.total_amount || 0); });
                        setSelectedItems(next);
                      }
                    }} /></th>
                  <th style={th}>สาขา</th>
                  <th style={th}>เลขใบกำกับ</th>
                  <th style={th}>วันที่</th>
                  <th style={th}>ลูกค้า</th>
                  <th style={th}>เลขเครื่อง</th>
                  <th style={th}>เลขถัง</th>
                  <th style={th}>รุ่น</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                  <th style={{ ...th, textAlign: "right" }}>จำนวนที่รับชำระ</th>
                  <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {displayedResults.map((r, i) => {
                  const key = `${r.branch}|${r.tax_invoice_no}`;
                  const isChecked = selectedItems[key] != null;
                  return (
                    <tr key={key} style={{ borderTop: "1px solid #e5e7eb", background: isChecked ? "#f0fdf4" : undefined }}>
                      <td style={{ ...td, textAlign: "center" }}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleItem(r)} />
                      </td>
                      <td style={{ ...td, fontSize: 11 }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", background: r.branch === "PAPAO" ? "#dbeafe" : "#fef3c7", color: r.branch === "PAPAO" ? "#1e40af" : "#92400e", borderRadius: 4, fontWeight: 600 }}>
                          {r.branch === "PAPAO" ? "ป.เปา" : "นครหลวง"}
                        </span>
                      </td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.tax_invoice_no}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.invoice_date)}</td>
                      <td style={td}>
                        {r.sale_customer_name ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{r.sale_customer_name}</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>📋 ไฟแนนท์: {r.customer_name || r.sale_finance_company || "-"}</div>
                          </>
                        ) : (
                          <span style={{ color: "#6b7280" }}>{r.customer_name || r.sale_finance_company || "-"}</span>
                        )}
                      </td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                      <td style={{ ...td, fontSize: 12 }}>{r.model_name || "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(r.total_amount)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {isChecked ? (
                          <input type="number" step="0.01" value={selectedItems[key]}
                            onChange={e => setItemAmount(key, e.target.value)}
                            style={{ ...inp, width: 110, fontFamily: "monospace", textAlign: "right", color: "#15803d", fontWeight: 700 }} />
                        ) : "-"}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                        {isChecked ? (() => {
                          const remain = Number(r.total_amount || 0) - Number(selectedItems[key] || 0);
                          if (Math.abs(remain) < 0.01) return <span style={{ color: "#15803d" }}>✓ ครบ</span>;
                          if (remain > 0) return <span style={{ color: "#dc2626" }}>{fmt(remain)}</span>;
                          return <span style={{ color: "#7c3aed" }}>+{fmt(-remain)}</span>;
                        })() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* สรุปยอด */}
          <div style={{ marginTop: 14, padding: "14px 16px", background: isComplete ? "#dcfce7" : "#fef3c7", borderRadius: 10, border: "1px solid " + (isComplete ? "#86efac" : "#fbbf24"), display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ fontSize: 14 }}>💰 ยอดเงินโอน: <strong>฿ {fmt(transferAmount)}</strong></span>
            <span style={{ fontSize: 14 }}>📋 ยอดที่จับคู่: <strong style={{ color: "#15803d" }}>฿ {fmt(matchedTotal)}</strong></span>
            <span style={{ fontSize: 14 }}>คงเหลือ: <strong style={{ color: Math.abs(remaining) < 0.01 ? "#15803d" : "#dc2626", fontSize: 18 }}>฿ {fmt(remaining)}</strong></span>
            {isComplete && <span style={{ padding: "4px 12px", background: "#15803d", color: "#fff", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>✅ ตัดครบยอด</span>}
          </div>

          {/* ปุ่มบันทึก */}
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button onClick={saveMatch} disabled={!isComplete || saving}
              style={{ padding: "12px 36px", background: !isComplete || saving ? "#9ca3af" : "#15803d", color: "#fff", border: "none", borderRadius: 10, cursor: !isComplete || saving ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700 }}>
              {saving ? "กำลังบันทึก..." : "💾 บันทึกการตัดรับชำระ"}
            </button>
            {!isComplete && Object.keys(selectedItems).length > 0 && (
              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>⚠️ ต้องตัดให้ครบยอดก่อนถึงจะบันทึกได้ (คงเหลือ ฿ {fmt(remaining)})</div>
            )}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

const card = { background: "#fff", padding: 18, borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 14, boxShadow: "0 2px 8px rgba(7,45,107,0.05)" };
const cardTitle = { fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 12 };
const inp = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13 };
