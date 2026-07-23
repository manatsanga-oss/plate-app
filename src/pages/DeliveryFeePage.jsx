import React, { useEffect, useState } from "react";

// ค่านำพา ใช้ accounting-api (จับคู่ moto_sales) · ค่าแนะนำ ใช้ referral-fee-api (จับคู่ expense_documents)
const ACCOUNTING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const REFERRAL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/referral-fee-api";

// config ของแต่ละแท็บ — โครงเดียวกัน (ใบจ่ายเงินสดย่อย ↔ เป้าหมาย) แต่คนละ API/เป้าหมายจับคู่
//   matchKind 'sale' = จับกับใบขาย moto_sales · 'doc' = จับกับเอกสารค่าใช้จ่าย expense_documents
const TABS = [
  {
    key: "delivery",
    label: "🚚 ค่านำพา",
    title: "🚚 บันทึกค่านำพา",
    api: ACCOUNTING_API,
    listAction: "list_delivery_fees",
    importAction: "import_delivery_fees_from_expenses",
    linkAction: "link_delivery_fee_sale",
    linkIdParam: "expense_id",
    matchKind: "sale",
    searchApi: ACCOUNTING_API,
    searchAction: "search_moto_sales_for_link",
    listLabel: "📋 รายการค่านำพา",
    importLabel: "📥 Import จาก daily_expenses",
    importConfirm: "Import รายการ 'ค่านำพา' จากตาราง daily_expenses เข้าตาราง delivery_fees?\n(เฉพาะรายการใหม่ที่ยังไม่ import + auto-match กับ moto_sales)",
    payeeHeader: "ผู้รับ",
    showDeliveryCols: true,   // ยอดจ่ายจริง / หัก ณ ที่จ่าย / เลขเครื่อง(note)
    showAffiliation: false,
    prefillSearch: false,
  },
  {
    // ค่าแนะนำ: ดึงรายการตรงจาก expense_documents (description=ค่าแนะนำ) — แสดงรายการอย่างเดียว ยังไม่จับคู่
    key: "referral",
    label: "💸 ค่าแนะนำ",
    title: "💸 บันทึกค่าแนะนำลูกค้า",
  },
];

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

async function postAPI(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function DeliveryFeePage({ currentUser }) {
  const [tab, setTab] = useState("delivery");
  const cfg = TABS.find(t => t.key === tab);
  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">{cfg.title}</h2>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 14,
              background: tab === t.key ? "#072d6b" : "#e5e7eb",
              color: tab === t.key ? "#fff" : "#374151",
            }}>{t.label}</button>
        ))}
      </div>

      {/* remount เมื่อสลับแท็บเพื่อล้าง state */}
      {cfg.key === "referral"
        ? <ReferralDocTab key={cfg.key} currentUser={currentUser} />
        : <FeeMatchTab key={cfg.key} cfg={cfg} currentUser={currentUser} />}
    </div>
  );
}

function FeeMatchTab({ cfg, currentUser }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI(cfg.api, { action: cfg.listAction, date_from: dateFrom, date_to: dateTo });
      setRows(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function doSearch(kw) {
    if (!kw.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const body = { action: cfg.searchAction, search: kw.trim() };
      // ค่าแนะนำ: จำกัดผลค้นเฉพาะสังกัดเดียวกับใบจ่าย (ป.เปา/สิงห์ชัย)
      if (cfg.matchKind === "doc" && editRow?.affiliation) body.affiliation = editRow.affiliation;
      // ค่านำพา: ซ่อนใบขายที่ถูกจับคู่กับรายการอื่นแล้ว (ห้ามจับซ้ำ) — ยกเว้นใบที่รายการนี้จับอยู่
      if (cfg.matchKind === "sale" && editRow?.id) body.exclude_expense_id = editRow.id;
      const data = await postAPI(cfg.searchApi, body);
      setSearchResults(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  // linkTarget: search-result row ที่เลือก (หรือ null = ล้างการจับคู่)
  async function linkSale(linkTarget) {
    if (!editRow) return;
    try {
      const body = {
        action: cfg.linkAction,
        [cfg.linkIdParam]: editRow.id,
        linked_by: currentUser?.username || currentUser?.name || "system",
      };
      let label;
      if (cfg.matchKind === "doc") {
        body.expense_doc_id = linkTarget ? linkTarget.id : 0;
        label = linkTarget ? linkTarget.expense_doc_no : "(ล้าง)";
      } else {
        body.sale_invoice_no = linkTarget ? linkTarget.invoice_no : "";
        label = linkTarget ? linkTarget.invoice_no : "(ล้าง)";
      }
      const res = await postAPI(cfg.api, body);
      const r0 = Array.isArray(res) ? res[0] : res;
      // ค่านำพา: ถ้าใบขายถูกจับคู่กับรายการอื่นแล้ว backend จะไม่จับให้ (status=duplicate)
      if (cfg.matchKind === "sale" && linkTarget && r0 && r0.status === "duplicate") {
        setMessage(`❌ ใบขาย ${label} ถูกจับคู่กับรายการอื่นแล้ว — ห้ามจับซ้ำ`);
        return;
      }
      setMessage(`✅ จับคู่กับ ${label} สำเร็จ`);
      setEditRow(null); setSearch(""); setSearchResults([]);
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  // ลบรายการที่ไม่ใช่ค่านำพาจริง (เช่น ค่าน้ำมัน) — soft delete (excluded=TRUE) ฝั่ง workflow กัน Import ดึงกลับมาซ้ำ
  async function deleteFee(row) {
    if (!window.confirm(`ลบรายการ ${row.payment_no} (${row.pay_to || "-"} · ${fmt(row.total_amount)}) ออกจากค่านำพา?\nรายการที่ลบจะไม่ถูก Import กลับมาอีก`)) return;
    try {
      await postAPI(cfg.api, { action: "delete_delivery_fee", id: row.id });
      setMessage(`✅ ลบรายการ ${row.payment_no} แล้ว`);
      fetchData();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  // key ที่ใช้บอกว่า row จับคู่แล้วหรือยัง (sale=เลขใบขาย, doc=เลขเอกสาร)
  const matchedOf = (r) => cfg.matchKind === "doc" ? r.matched_doc_no : r.matched_invoice_no;

  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const matched = rows.filter(r => matchedOf(r)).length;
  const unmatched = rows.length - matched;
  const manual = rows.filter(r => r.linked_manual).length;
  // เลขที่ใบขายซ้ำ = เลขใบขายที่ถูกจับคู่กับค่านำพามากกว่า 1 แถว
  const dupInvoices = (() => {
    const cnt = {};
    rows.forEach(r => { const k = matchedOf(r); if (k) cnt[k] = (cnt[k] || 0) + 1; });
    return Object.values(cnt).filter(c => c > 1).length;
  })();
  const colCount = cfg.showDeliveryCols ? 15 : (cfg.showAffiliation ? 12 : 11);

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <button onClick={async () => {
            if (!window.confirm(cfg.importConfirm)) return;
            try {
              const res = await postAPI(cfg.api, { action: cfg.importAction });
              const r = Array.isArray(res) ? res[0] : res;
              setMessage(`✅ Import ${r?.imported || 0} รายการ · auto-match ${r?.auto_linked || 0} ใบ`);
              fetchData();
            } catch { setMessage("❌ Import ไม่สำเร็จ"); }
          }} style={{ ...btnBlue, background: "#7c3aed", marginLeft: "auto" }}>
          {cfg.importLabel}
        </button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#15803d" : "#b91c1c", background: message.startsWith("✅") ? "#dcfce7" : "#fef2f2", borderRadius: 6 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label={cfg.listLabel} value={rows.length} color="#1e40af" />
        <Card label="✅ จับคู่ได้" value={`${matched}/${rows.length}`} color="#059669" />
        <Card label="⚠️ ยังไม่จับคู่" value={unmatched} color="#b91c1c" />
        {cfg.matchKind === "sale" && <Card label="🔁 เลขที่ใบขายซ้ำ" value={dupInvoices} color={dupInvoices > 0 ? "#dc2626" : "#64748b"} />}
        <Card label="✏️ จับคู่เอง" value={manual} color="#7c3aed" />
        <Card label="💰 ยอดรวม" value={fmt(total)} color="#059669" highlight />
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>เลขที่จ่าย</th>
              <th style={th}>วันที่จ่าย</th>
              <th style={th}>{cfg.payeeHeader}</th>
              {cfg.showAffiliation && <th style={th}>สังกัด</th>}
              <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
              {cfg.showDeliveryCols && <th style={{ ...th, textAlign: "right" }}>ยอดจ่ายจริง</th>}
              {cfg.showDeliveryCols && <th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th>}
              {cfg.showDeliveryCols && <th style={th}>หมายเหตุ</th>}
              {cfg.showDeliveryCols && <th style={th}>เลขเครื่อง (ดึงจาก note)</th>}
              {cfg.matchKind === "doc" ? (
                <>
                  <th style={{ ...th, background: "#16a34a" }}>เลขเอกสาร (matched)</th>
                  <th style={{ ...th, background: "#16a34a" }}>วันที่เอกสาร</th>
                  <th style={{ ...th, background: "#16a34a" }}>ผู้จำหน่าย</th>
                  <th style={{ ...th, background: "#16a34a", textAlign: "right" }}>ยอดเอกสาร</th>
                </>
              ) : (
                <>
                  <th style={{ ...th, background: "#16a34a" }}>เลขใบขาย (matched)</th>
                  <th style={{ ...th, background: "#16a34a" }}>วันขาย</th>
                  <th style={{ ...th, background: "#16a34a" }}>ลูกค้า</th>
                  <th style={{ ...th, background: "#16a34a" }}>รุ่น</th>
                </>
              )}
              <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
              <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={colCount} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={colCount} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล{cfg.showDeliveryCols ? "" : " — กด Import จาก daily_expenses"}</td></tr>}
            {rows.map((r, i) => {
              const isMatched = !!matchedOf(r);
              const isManual = !!r.linked_manual;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: isMatched ? (isManual ? "#f3e8ff" : "#ecfdf5") : "#fef2f2" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.payment_no || "-"}</td>
                  <td style={td}>{fmtDate(r.payment_date)}</td>
                  <td style={td}>{r.pay_to || "-"}</td>
                  {cfg.showAffiliation && <td style={{ ...td, fontSize: 11 }}>{r.affiliation || "-"}</td>}
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626", fontWeight: 700 }}>{fmt(r.total_amount)}</td>
                  {cfg.showDeliveryCols && <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0f766e", fontWeight: 600 }}>{fmt(r.cash_amount)}</td>}
                  {cfg.showDeliveryCols && <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{fmt(r.withholding_tax)}</td>}
                  {cfg.showDeliveryCols && <td style={{ ...td, fontSize: 11, maxWidth: 200, wordBreak: "break-word" }}>{r.note || "-"}</td>}
                  {cfg.showDeliveryCols && <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#92400e" }}>{r.engine_no_in_note || "-"}</td>}
                  {cfg.matchKind === "doc" ? (
                    <>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: isMatched ? "#065f46" : "#9ca3af" }}>{r.matched_doc_no || "-"}</td>
                      <td style={td}>{fmtDate(r.matched_doc_date)}</td>
                      <td style={{ ...td, fontSize: 11 }}>{r.matched_vendor || "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.matched_amount != null ? fmt(r.matched_amount) : "-"}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: isMatched ? "#065f46" : "#9ca3af" }}>{r.matched_invoice_no || "-"}</td>
                      <td style={td}>{fmtDate(r.matched_sale_date)}</td>
                      <td style={{ ...td, fontSize: 11 }}>{r.matched_customer || "-"}</td>
                      <td style={{ ...td, fontSize: 11 }}>{r.matched_brand && r.matched_model_series ? `${r.matched_brand} · ${r.matched_model_series}` : "-"}</td>
                    </>
                  )}
                  <td style={{ ...td, textAlign: "center" }}>
                    {!isMatched ? (
                      <span style={{ padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>⚠️ ยังไม่จับคู่</span>
                    ) : isManual ? (
                      <span style={{ padding: "2px 8px", background: "#a78bfa", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>✏️ Manual</span>
                    ) : (
                      <span style={{ padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>✅ Auto</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                    <button onClick={() => { setEditRow(r); setSearch(cfg.prefillSearch ? (r.pay_to || "") : ""); setSearchResults([]); }}
                      style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{cfg.matchKind === "doc" ? "✏️ เลือกเอกสาร" : (cfg.showDeliveryCols ? "✏️ แก้ไข" : "✏️ เลือกใบขาย")}</button>
                    {/* ลบรายการที่ไม่ใช่ค่านำพาจริง (เช่น ค่าน้ำมัน) — soft delete ไม่ถูก Import กลับมาอีก */}
                    {cfg.matchKind === "sale" && (
                      <button onClick={() => deleteFee(r)}
                        style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600, marginLeft: 4 }}>🗑 ลบ</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}
             onClick={() => setEditRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "95%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff" }}>
              <h3 style={{ margin: 0 }}>{cfg.matchKind === "doc" ? "✏️ จับคู่เอกสารค่าแนะนำ" : "✏️ จับคู่ใบขาย"} — {editRow.payment_no}</h3>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                {cfg.showDeliveryCols
                  ? <>ผู้รับ: {editRow.pay_to} · ยอด {fmt(editRow.total_amount)} · note: <span style={{ fontFamily: "monospace" }}>{editRow.note}</span></>
                  : <>นายหน้า: {editRow.pay_to} · ยอด {fmt(editRow.total_amount)} · วันที่จ่าย {fmtDate(editRow.payment_date)}{editRow.affiliation ? ` · สังกัด ${editRow.affiliation}` : ""}</>}
                {matchedOf(editRow) && <span> · ปัจจุบันจับคู่: <strong>{matchedOf(editRow)}</strong></span>}
              </div>
            </div>
            <div style={{ padding: 14, overflow: "auto", flex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") doSearch(search); }}
                  placeholder={cfg.matchKind === "doc" ? "🔍 ค้นหา: เลขที่เอกสาร, ผู้จำหน่าย, ยอดเงิน" : "🔍 ค้นหา: เลขใบขาย, เลขเครื่อง, เลขถัง, ชื่อลูกค้า"}
                  style={{ ...inp, flex: 1 }} />
                <button onClick={() => doSearch(search)} disabled={searching || !search.trim()} style={btnBlue}>
                  {searching ? "..." : "🔍 ค้นหา"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: "#072d6b" }}>ผลค้นหา ({searchResults.length})</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f0f4f9" }}>
                      {cfg.matchKind === "doc" ? (
                        <tr>
                          <th style={th}>เลขที่เอกสาร</th>
                          <th style={th}>วันที่</th>
                          <th style={th}>ผู้จำหน่าย</th>
                          <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
                          <th style={th}>สังกัด</th>
                          <th style={{ ...th, textAlign: "center" }}>เลือก</th>
                        </tr>
                      ) : (
                        <tr>
                          <th style={th}>เลขใบขาย</th>
                          <th style={th}>วันที่</th>
                          <th style={th}>ลูกค้า</th>
                          <th style={th}>เลขเครื่อง</th>
                          <th style={th}>เลขถัง</th>
                          <th style={th}>รุ่น</th>
                          <th style={{ ...th, textAlign: "center" }}>เลือก</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {searchResults.map(s => (
                        <tr key={s.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                          {cfg.matchKind === "doc" ? (
                            <>
                              <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{s.expense_doc_no}</td>
                              <td style={td}>{fmtDate(s.doc_date)}</td>
                              <td style={td}>{s.vendor_name || "-"}</td>
                              <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(s.total)}</td>
                              <td style={{ ...td, fontSize: 11 }}>{s.affiliation || "-"}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{s.invoice_no}</td>
                              <td style={td}>{fmtDate(s.sale_date)}</td>
                              <td style={td}>{s.customer_name || "-"}</td>
                              <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.engine_no || "-"}</td>
                              <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.chassis_no || "-"}</td>
                              <td style={td}>{[s.brand, s.model_series].filter(Boolean).join(" · ")}</td>
                            </>
                          )}
                          <td style={{ ...td, textAlign: "center" }}>
                            <button onClick={() => linkSale(s)}
                              style={{ padding: "4px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✅ จับคู่</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ padding: 12, borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "space-between" }}>
              {matchedOf(editRow) && (
                <button onClick={() => linkSale(null)} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  🚫 ล้างการจับคู่
                </button>
              )}
              <button onClick={() => setEditRow(null)} style={{ marginLeft: "auto", padding: "8px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// แท็บค่าแนะนำ — ดึงค่านำพา (034:ค่านำพา) จาก daily_expenses + จับคู่ expense_documents
// (วันที่จ่าย + ผู้รับ + จำนวนเงิน) → แสดงเลขที่เอกสารเมื่อจับคู่ได้
function ReferralDocTab({ currentUser }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [matchModal, setMatchModal] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [candLoading, setCandLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [affFilter, setAffFilter] = useState("");

  // ช่วงค้นหา = วันจ่าย ถึง +3 วันหลัง (ไม่ดูยอด/ชื่อ — ดูแค่ประเภทค่าแนะนำเดียวกัน)
  function searchRange(dateStr) {
    const pad = n => String(n).padStart(2, "0");
    const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const base = new Date(dateStr);
    const end = new Date(base); end.setDate(end.getDate() + 3);
    return { start: isoOf(base), end: isoOf(end) };
  }
  async function openMatch(row) {
    setMatchModal({ row }); setCandidates([]); setCandLoading(true);
    try {
      const { start, end } = searchRange(row.payment_date);
      const d = await postAPI(REFERRAL_API, { action: "get_referral_candidates", from: start, to: end });
      setCandidates((Array.isArray(d) ? d : d.rows || []).filter(x => x && x.id));
    } catch { setCandidates([]); }
    setCandLoading(false);
  }
  async function saveMatch(edId) {
    if (!matchModal) return;
    setSaving(true);
    try {
      await postAPI(REFERRAL_API, { action: "set_referral_match", daily_expense_id: matchModal.row.id, expense_doc_id: edId, matched_by: currentUser?.name || currentUser?.username || "system" });
      setMatchModal(null); fetchData();
    } catch {}
    setSaving(false);
  }
  async function clearMatch(row) {
    setSaving(true);
    try {
      await postAPI(REFERRAL_API, { action: "set_referral_match", daily_expense_id: row.id, expense_doc_id: 0 });
      setMatchModal(null); fetchData();
    } catch {}
    setSaving(false);
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI(REFERRAL_API, { action: "list_referral_fees", date_from: dateFrom, date_to: dateTo });
      setRows(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  // ตัวเลือกสังกัดจากข้อมูลที่โหลดมา (ปกติ = ป.เปา / สิงห์ชัย)
  const affOptions = [...new Set(rows.map(r => r.affiliation).filter(Boolean))].sort();
  const shownRows = affFilter ? rows.filter(r => (r.affiliation || "") === affFilter) : rows;

  const total = shownRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const matched = shownRows.filter(r => r.matched_doc_no).length;
  const unmatched = shownRows.length - matched;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <span>สังกัด:</span>
        <select value={affFilter} onChange={e => setAffFilter(e.target.value)} style={inp}>
          <option value="">ทั้งหมด</option>
          {affOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>📄 daily_expenses → จับคู่ expense_documents (วันที่+ผู้รับ+จำนวนเงิน)</span>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#15803d" : "#b91c1c", background: message.startsWith("✅") ? "#dcfce7" : "#fef2f2", borderRadius: 6 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="📋 รายการค่านำพา" value={shownRows.length} color="#1e40af" />
        <Card label="✅ จับคู่ได้" value={`${matched}/${shownRows.length}`} color="#059669" />
        <Card label="⚠️ ยังไม่จับคู่" value={unmatched} color="#b91c1c" />
        <Card label="💰 ยอดรวม" value={fmt(total)} color="#059669" highlight />
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>เลขที่จ่าย</th>
              <th style={th}>วันที่จ่าย</th>
              <th style={th}>ผู้รับ</th>
              <th style={th}>สังกัด</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดจ่ายจริง</th>
              <th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th>
              <th style={{ ...th, background: "#16a34a" }}>เลขที่เอกสาร (จับคู่)</th>
              <th style={th}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && shownRows.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {shownRows.map((r, i) => {
              const isMatched = !!r.matched_doc_no;
              return (
              <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: isMatched ? "#ecfdf5" : "#fef2f2" }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{r.payment_no || "-"}</td>
                <td style={td}>{fmtDate(r.payment_date)}</td>
                <td style={td}>{r.pay_to || "-"}</td>
                <td style={{ ...td, fontSize: 11 }}>{r.affiliation ? <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: r.affiliation === "ป.เปา" ? "#fee2e2" : "#dbeafe", color: r.affiliation === "ป.เปา" ? "#991b1b" : "#1e40af" }}>{r.affiliation}</span> : "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626", fontWeight: 700 }}>{fmt(r.total_amount)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0f766e", fontWeight: 600 }}>{fmt(r.cash_amount)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{fmt(r.withholding_tax)}</td>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: isMatched ? "#065f46" : "#9ca3af" }}>
                  {r.matched_doc_no || "—"}
                  {r.match_type === "manual" && <span style={{ marginLeft: 6, fontSize: 10, color: "#7c3aed", background: "#f3e8ff", padding: "1px 5px", borderRadius: 6, fontFamily: "Tahoma" }}>เลือกเอง</span>}
                </td>
                <td style={td}>
                  <button onClick={() => openMatch(r)} title="จับคู่เอกสารเอง"
                    style={{ padding: "4px 10px", border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                    🔗 จับคู่
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {matchModal && (
        <div onClick={() => setMatchModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 20, width: 560, maxWidth: "92vw", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🔗 เลือกเอกสารค่าแนะนำ (จับคู่เอง)</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              รายการจ่าย <b>{matchModal.row.payment_no}</b> · {matchModal.row.pay_to || "-"} · ยอด <b>{fmt(matchModal.row.total_amount)}</b> · {fmtDate(matchModal.row.payment_date)}
              <br />กรอง: ประเภทค่าแนะนำเดียวกัน · ภายใน 3 วันหลังวันจ่าย · ใบที่ยังไม่ถูกจับคู่ (ไม่ดูชื่อ/ยอดเงิน)
            </div>
            {candLoading ? (
              <div style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>กำลังโหลด...</div>
            ) : candidates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>ไม่พบเอกสารค่าแนะนำใน 3 วันหลังวันจ่าย (ที่ยังว่าง)</div>
            ) : (
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {candidates.map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#065f46", fontFamily: "monospace" }}>{c.doc_no}
                        {c.affiliation && <span style={{ marginLeft: 6, fontSize: 11, color: "#2563eb", fontFamily: "Tahoma" }}>· {c.affiliation}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#374151" }}>{c.vendor_name || "-"}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {fmtDate(c.doc_date)} · ยอด {fmt(c.total)}{c.description ? ` · ${c.description}` : ""}
                      </div>
                    </div>
                    <button disabled={saving} onClick={() => saveMatch(c.id)}
                      style={{ padding: "5px 14px", border: "none", background: "#16a34a", color: "#fff", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                      เลือก
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              {matchModal.row.match_type === "manual" ? (
                <button disabled={saving} onClick={() => clearMatch(matchModal.row)}
                  style={{ padding: "6px 14px", border: "1px solid #dc2626", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                  ✖ ลบจับคู่ปัจจุบัน
                </button>
              ) : <span />}
              <button onClick={() => setMatchModal(null)}
                style={{ padding: "6px 16px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
