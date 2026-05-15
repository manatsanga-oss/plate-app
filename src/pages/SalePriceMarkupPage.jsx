import React, { useEffect, useState } from "react";

const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function fmtDateTime(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const TABS = [
  { key: "finance",            label: "ตามไฟแนนท์",                          emoji: "💳", color: "#1e40af" },
  { key: "finance_cc",         label: "ตามไฟแนนท์ + CC",                     emoji: "🏍️", color: "#7c3aed" },
  { key: "custom",             label: "กำหนดเอง",                            emoji: "✏️", color: "#ea580c" },
  { key: "installment_bonus",  label: "บวกเพิ่มจากค่างวดออกแทน",            emoji: "🧮", color: "#0891b2" },
  { key: "cosmos_insurance",   label: "ประกัน COSMOS ซื้อเพิ่ม",             emoji: "🛡️", color: "#92400e" },
];

const EMPTY_ROW = {
  id: null, markup_type: "finance", finance_company: "", cc_min: "", cc_max: "",
  model_code: "", brand: "", branch_group: "all", sale_invoice_no: "", sale_id: null,
  policy_no: "", markup_amount: "", effective_date: "", end_date: "", status: "active", notes: "",
};

export default function SalePriceMarkupPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [financeCos, setFinanceCos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState(null);
  const [activeTab, setActiveTab] = useState("finance");
  const [showHistory, setShowHistory] = useState(false);
  const [saleSearch, setSaleSearch] = useState("");
  const [saleResults, setSaleResults] = useState([]);

  async function fetchFinance() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_finance_companies" }),
      });
      const data = await res.json();
      setFinanceCos(Array.isArray(data) ? data.filter(c => c.status !== "inactive") : []);
    } catch (e) { /* ignore */ }
  }
  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_price_markups" }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch (e) {
      setRows([]); setMessage("❌ โหลดไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }
  useEffect(() => { fetchFinance(); fetchData(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!edit) return;
    if (!edit.markup_amount || Number(edit.markup_amount) === 0) { alert("กรอกยอดบวกเพิ่ม"); return; }
    if (edit.markup_type === "finance" && !edit.finance_company) { alert("เลือกบริษัทไฟแนนท์"); return; }
    if (edit.markup_type === "finance_cc" && (!edit.finance_company || !edit.cc_min || !edit.branch_group)) { alert("กรอกไฟแนนท์ + CC + ร้านที่ขาย"); return; }
    if (edit.markup_type === "installment_bonus" && !edit.sale_invoice_no) { alert("เลือกใบขาย"); return; }
    if (edit.markup_type === "cosmos_insurance" && !edit.sale_invoice_no) { alert("เลือกรายการประกัน COSMOS"); return; }

    setMessage("⏳ กำลังบันทึก...");
    try {
      const body = { action: "save_price_markup", ...edit, created_by: currentUser?.username || "system" };
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      const ok = (Array.isArray(data) ? data[0] : data)?.id || (Array.isArray(data) ? data[0] : data)?.updated;
      if (!ok) throw new Error("save fail");
      setMessage("✅ บันทึกแล้ว"); setEdit(null); fetchData();
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
  }

  async function cancelRow(r) {
    if (!confirm("ยกเลิกเงื่อนไขนี้? (จะย้ายไปอยู่ในประวัติ)")) return;
    try {
      await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_price_markup", ...r, status: "inactive", end_date: r.end_date || new Date().toISOString().slice(0, 10) }),
      });
      fetchData();
    } catch (e) { alert("ยกเลิกไม่สำเร็จ"); }
  }
  async function restoreRow(r) {
    if (!confirm("เปิดใช้งานเงื่อนไขนี้อีกครั้ง?")) return;
    try {
      await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_price_markup", ...r, status: "active" }),
      });
      fetchData();
    } catch (e) { alert("เปิดใช้งานไม่สำเร็จ"); }
  }
  async function hardDelete(id) {
    if (!confirm("ลบถาวร? จะไม่สามารถกู้คืนได้")) return;
    try {
      await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_price_markup", id }),
      });
      fetchData();
    } catch (e) { alert("ลบไม่สำเร็จ"); }
  }

  async function searchSales() {
    const kw = saleSearch.trim();
    if (!kw) { setSaleResults([]); return; }
    const action = edit?.markup_type === "cosmos_insurance" ? "search_cosmos_theft" : "search_moto_sales_for_link";
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, search: kw }),
      });
      const data = await res.json();
      setSaleResults(Array.isArray(data) ? data : []);
    } catch (e) { setSaleResults([]); }
  }

  const currentTab = TABS.find(t => t.key === activeTab);
  const tabRows = rows.filter(r => r.markup_type === activeTab);
  const activeRows = tabRows.filter(r => r.status === "active");
  const inactiveRows = tabRows.filter(r => r.status !== "active");

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💵 เงื่อนไขราคาขายบวกเพิ่ม</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "2px solid #e5e7eb", marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map(t => {
          const cnt = rows.filter(r => r.markup_type === t.key && r.status === "active").length;
          const isActive = t.key === activeTab;
          return (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setShowHistory(false); }}
              style={{
                padding: "10px 16px", border: "none",
                background: isActive ? t.color : "#f3f4f6",
                color: isActive ? "#fff" : "#374151",
                fontWeight: 600, cursor: "pointer", borderRadius: "8px 8px 0 0",
                borderBottom: isActive ? `3px solid ${t.color}` : "none",
                fontSize: 14,
              }}>
              {t.emoji} {t.label} {cnt > 0 && <span style={{ marginLeft: 6, padding: "1px 8px", background: isActive ? "#ffffff33" : "#e5e7eb", borderRadius: 10, fontSize: 11 }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setEdit({ ...EMPTY_ROW, markup_type: activeTab })} style={{ ...btnBlue, background: currentTab?.color }}>+ เพิ่มเงื่อนไข</button>
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <button onClick={() => setShowHistory(s => !s)} style={{ ...btnBlue, background: showHistory ? "#6b7280" : "#9ca3af" }}>
          📋 ประวัติ ({inactiveRows.length}) {showHistory ? "▼" : "▶"}
        </button>
        <span style={{ color: currentTab?.color, fontSize: 13, marginLeft: "auto" }}>
          {currentTab?.emoji} ใช้งานอยู่: <strong>{activeRows.length}</strong> · ยกเลิก: <strong>{inactiveRows.length}</strong>
        </span>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("❌") ? "#b91c1c" : "#065f46" }}>{message}</div>}

      {/* Active rules */}
      <RuleTable
        title="✅ ใช้งานอยู่"
        rows={activeRows} tab={currentTab}
        onEdit={r => setEdit(r)}
        onCancel={cancelRow}
      />

      {/* History */}
      {showHistory && (
        <div style={{ marginTop: 16 }}>
          <RuleTable
            title="📋 ประวัติ (ยกเลิกแล้ว)"
            rows={inactiveRows} tab={currentTab}
            onRestore={restoreRow}
            onDelete={hardDelete}
            isHistory
          />
        </div>
      )}

      {/* Edit Modal */}
      {edit && (
        <div onClick={() => setEdit(null)} style={modalOv}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 600 }}>
            <h3 style={{ margin: "0 0 12px" }}>
              {edit.id ? "✏️ แก้ไข" : "+ เพิ่ม"} เงื่อนไข · {TABS.find(t => t.key === edit.markup_type)?.label}
            </h3>

            {(edit.markup_type === "finance" || edit.markup_type === "finance_cc") && (
              <Field label="บริษัทไฟแนนท์ *">
                <select value={edit.finance_company || ""} onChange={e => setEdit({ ...edit, finance_company: e.target.value })} style={inp}>
                  <option value="">-- เลือก --</option>
                  {financeCos.map(c => <option key={c.id || c.company_name} value={c.company_name}>{c.company_name}</option>)}
                </select>
              </Field>
            )}

            {edit.markup_type === "finance_cc" && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="CC ต่ำสุด *">
                    <input type="number" value={edit.cc_min || ""} onChange={e => setEdit({ ...edit, cc_min: e.target.value })} style={inp} placeholder="110" />
                  </Field>
                  <Field label="CC สูงสุด">
                    <input type="number" value={edit.cc_max || ""} onChange={e => setEdit({ ...edit, cc_max: e.target.value })} style={inp} placeholder="125 (ว่าง=ไม่จำกัด)" />
                  </Field>
                </div>
                <Field label="ร้านที่ขาย *">
                  <select value={edit.branch_group || ""} onChange={e => setEdit({ ...edit, branch_group: e.target.value })} style={inp}>
                    <option value="">-- เลือกสาขา --</option>
                    <option value="SCY01">SCY01</option>
                    <option value="SCY04">SCY04</option>
                    <option value="SCY05">SCY05</option>
                    <option value="SCY06">SCY06</option>
                    <option value="SCY07">SCY07</option>
                  </select>
                </Field>
              </>
            )}

            {edit.markup_type === "custom" && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="ยี่ห้อ">
                    <input value={edit.brand || ""} onChange={e => setEdit({ ...edit, brand: e.target.value })} style={inp} placeholder="Honda / Yamaha" />
                  </Field>
                  <Field label="รหัสรุ่น">
                    <input value={edit.model_code || ""} onChange={e => setEdit({ ...edit, model_code: e.target.value })} style={inp} placeholder="ACF125CAT (ว่าง=ทุกรุ่น)" />
                  </Field>
                </div>
                <Field label="กลุ่มสาขา">
                  <select value={edit.branch_group || "all"} onChange={e => setEdit({ ...edit, branch_group: e.target.value })} style={inp}>
                    <option value="all">ทั้งหมด</option>
                    <option value="singchai">สิงห์ชัย (SCY01/04/07)</option>
                    <option value="papao">ป.เปา (SCY05/06)</option>
                  </select>
                </Field>
              </>
            )}

            {edit.markup_type === "installment_bonus" && (
              <>
                <Field label="ใบขาย *">
                  {edit.sale_invoice_no ? (
                    <div style={{ padding: 8, background: "#ecfdf5", border: "1px solid #10b981", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#065f46" }}>{edit.sale_invoice_no}</span>
                      <button onClick={() => setEdit({ ...edit, sale_invoice_no: "", sale_id: null })} style={{ ...btnMini, background: "#dc2626" }}>✕</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={saleSearch} onChange={e => setSaleSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchSales()} placeholder="🔍 เลขใบขาย / ลูกค้า / เลขเครื่อง" style={inp} />
                        <button onClick={searchSales} style={btnBlue}>ค้นหา</button>
                      </div>
                      {saleResults.length > 0 && (
                        <div style={{ marginTop: 6, maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                          {saleResults.map(s => (
                            <div key={s.id} onClick={() => { setEdit({ ...edit, sale_invoice_no: s.invoice_no, sale_id: s.id }); setSaleResults([]); setSaleSearch(""); }}
                              style={{ padding: 8, borderBottom: "1px solid #f3f4f6", cursor: "pointer", fontSize: 12 }}
                              onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                              <div style={{ fontWeight: 600, color: "#0369a1" }}>{s.invoice_no}</div>
                              <div style={{ color: "#374151" }}>{s.customer_name} · {s.brand} {s.model_series}</div>
                              <div style={{ color: "#6b7280", fontSize: 11 }}>เครื่อง: {s.engine_no || "-"} · {fmtDate(s.sale_date)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Field>
              </>
            )}

            {edit.markup_type === "cosmos_insurance" && (
              <>
                <Field label="รายการประกัน COSMOS *">
                  {edit.sale_invoice_no ? (
                    <div style={{ padding: 8, background: "#fef3c7", border: "1px solid #92400e", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#92400e" }}>{edit.sale_invoice_no}</span>
                      <button onClick={() => setEdit({ ...edit, sale_invoice_no: "", sale_id: null, policy_no: "" })} style={{ ...btnMini, background: "#dc2626" }}>✕</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={saleSearch} onChange={e => setSaleSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchSales()} placeholder="🔍 App No / ลูกค้า / เลขถัง / เลขใบขาย / เลขกรมธรรม์" style={inp} />
                        <button onClick={searchSales} style={btnBlue}>ค้นหา</button>
                      </div>
                      {saleResults.length > 0 && (
                        <div style={{ marginTop: 6, maxHeight: 220, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                          {saleResults.map(s => (
                            <div key={s.id} onClick={() => { setEdit({ ...edit, sale_invoice_no: s.sale_invoice_no || "", policy_no: s.policy_no || edit.policy_no || "", sale_id: null }); setSaleResults([]); setSaleSearch(""); }}
                              style={{ padding: 8, borderBottom: "1px solid #f3f4f6", cursor: "pointer", fontSize: 12 }}
                              onMouseEnter={e => e.currentTarget.style.background = "#fffbeb"}
                              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                              <div style={{ fontWeight: 600, color: "#92400e", fontFamily: "monospace" }}>{s.app_no || "-"}</div>
                              <div style={{ color: "#374151" }}>{s.customer_name || "-"}</div>
                              <div style={{ color: "#6b7280", fontSize: 11 }}>
                                ขาย: {s.sale_invoice_no || "-"} · ถัง: {s.chassis_no || "-"}{s.policy_no ? ` · กรมธรรม์: ${s.policy_no}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Field>
                <Field label="เลขที่กรมธรรม์">
                  <input value={edit.policy_no || ""} onChange={e => setEdit({ ...edit, policy_no: e.target.value })} style={inp} placeholder="เช่น POL-2025-001234" />
                </Field>
              </>
            )}

            <Field label="ยอดบวกเพิ่ม (บาท) *">
              <input type="number" value={edit.markup_amount || ""} onChange={e => setEdit({ ...edit, markup_amount: e.target.value })} style={{ ...inp, fontWeight: 700, fontSize: 16 }} placeholder="1000" />
            </Field>

            <div style={{ display: "flex", gap: 8 }}>
              <Field label="วันที่เริ่มมีผล">
                <input type="date" value={edit.effective_date || ""} onChange={e => setEdit({ ...edit, effective_date: e.target.value })} style={inp} />
              </Field>
              <Field label="วันที่สิ้นสุด">
                <input type="date" value={edit.end_date || ""} onChange={e => setEdit({ ...edit, end_date: e.target.value })} style={inp} />
              </Field>
            </div>

            <Field label="หมายเหตุ">
              <textarea value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} style={{ ...inp, minHeight: 60 }} />
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setEdit(null)} style={{ ...btnBlue, background: "#6b7280" }}>ยกเลิก</button>
              <button onClick={save} style={{ ...btnBlue, background: "#059669" }}>💾 บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleTable({ title, rows, tab, onEdit, onCancel, onRestore, onDelete, isHistory }) {
  const showBranch = tab?.key === "finance_cc";
  if (rows.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, textAlign: "center", color: "#9ca3af" }}>
        {isHistory ? "ไม่มีประวัติ" : "ยังไม่มีข้อมูล กดปุ่ม + เพิ่มเงื่อนไข"}
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ padding: "8px 14px", background: isHistory ? "#f3f4f6" : tab?.color, color: isHistory ? "#374151" : "#fff", fontWeight: 700, fontSize: 13 }}>
        {title}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "#f9fafb" }}>
          <tr>
            <th style={th}>#</th>
            <th style={th}>เงื่อนไข</th>
            {showBranch && <th style={th}>สาขา</th>}
            <th style={{ ...th, textAlign: "right" }}>ยอด</th>
            <th style={th}>วันที่มีผล</th>
            <th style={th}>{isHistory ? "ยกเลิกเมื่อ" : "บันทึกล่าสุด"}</th>
            <th style={th}>โดย</th>
            <th style={th}>หมายเหตุ</th>
            <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", opacity: isHistory ? 0.7 : 1 }}>
              <td style={td}>{i + 1}</td>
              <td style={td}>
                {r.markup_type === "finance" && <span style={{ fontWeight: 600 }}>{r.finance_company || "-"}</span>}
                {r.markup_type === "finance_cc" && (
                  <>
                    <div style={{ fontWeight: 600 }}>{r.finance_company || "-"}</div>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>CC: {r.cc_min || 0} – {r.cc_max || "∞"}</div>
                  </>
                )}
                {r.markup_type === "custom" && (
                  <div style={{ fontWeight: 600 }}>{r.brand || ""} {r.model_code || "ทุกรุ่น"}</div>
                )}
                {r.markup_type === "installment_bonus" && (
                  <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.sale_invoice_no || "-"}</span>
                )}
                {r.markup_type === "cosmos_insurance" && (
                  <>
                    <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#92400e" }}>{r.sale_invoice_no || "-"}</div>
                    {r.policy_no && <div style={{ color: "#6b7280", fontSize: 11 }}>กรมธรรม์: {r.policy_no}</div>}
                  </>
                )}
              </td>
              {showBranch && (
                <td style={{ ...td, fontSize: 11 }}>
                  {r.branch_group ? (
                    <span style={{ padding: "2px 8px", background: "#e0e7ff", color: "#3730a3", borderRadius: 8, fontFamily: "monospace", fontWeight: 600 }}>{r.branch_group}</span>
                  ) : <span style={{ color: "#9ca3af" }}>-</span>}
                </td>
              )}
              <td style={{ ...td, textAlign: "right", fontWeight: 700, color: tab?.color, fontFamily: "monospace" }}>+{fmt(r.markup_amount)}</td>
              <td style={{ ...td, fontSize: 11 }}>
                {fmtDate(r.effective_date)}
                {r.end_date && <div style={{ color: "#9ca3af" }}>ถึง {fmtDate(r.end_date)}</div>}
              </td>
              <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{fmtDateTime(r.updated_at)}</td>
              <td style={{ ...td, fontSize: 11 }}>{r.created_by || "-"}</td>
              <td style={{ ...td, fontSize: 11, color: "#9ca3af" }}>{r.notes || "-"}</td>
              <td style={{ ...td, textAlign: "center" }}>
                {!isHistory && (
                  <>
                    <button onClick={() => onEdit(r)} style={{ ...btnMini, background: "#f59e0b", marginRight: 4 }}>✏️</button>
                    <button onClick={() => onCancel(r)} style={{ ...btnMini, background: "#dc2626" }}>ยกเลิก</button>
                  </>
                )}
                {isHistory && (
                  <>
                    <button onClick={() => onRestore(r)} style={{ ...btnMini, background: "#10b981", marginRight: 4 }}>↻ เปิดใช้</button>
                    <button onClick={() => onDelete(r.id)} style={{ ...btnMini, background: "#7c2d12" }}>🗑️</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10, flex: 1 }}>
      <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

const th = { padding: "6px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", borderBottom: "1px solid #e5e7eb" };
const td = { padding: "8px 10px", fontSize: 12 };
const inp = { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box" };
const btnBlue = { padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnMini = { padding: "3px 8px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 };
const modalOv = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 20, borderRadius: 10, width: "92%", maxHeight: "90vh", overflowY: "auto" };
