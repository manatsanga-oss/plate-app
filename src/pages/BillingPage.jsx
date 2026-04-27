import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function BillingPage({ currentUser }) {
  const [brand, setBrand] = useState("ฮอนด้า");
  const [category, setCategory] = useState("ค่าจดทะเบียน");
  const [categoryOpts, setCategoryOpts] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [runFilters, setRunFilters] = useState([]); // array of run_code
  const [showBilled, setShowBilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [viewMode, setViewMode] = useState("pending");  // 'pending' | 'history'
  const [historyExpanded, setHistoryExpanded] = useState({});
  const [editingDiscount, setEditingDiscount] = useState({ amount: 0, note: "" });
  const [savingDiscount, setSavingDiscount] = useState(false);

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchCategories() {
    try {
      const data = await post({ action: "get_expense_categories" });
      const cats = (Array.isArray(data) ? data : []).map(r => r.category).filter(Boolean);
      setCategoryOpts(cats);
      if (cats.length && !cats.includes(category)) setCategory(cats[0]);
    } catch {}
  }

  async function fetchData() {
    if (!brand || !category) return;
    setLoading(true);
    setSelected({});
    try {
      const data = await post({
        action: "get_billing_data",
        brand, category,
        only_unbilled: !showBilled,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [brand, category, showBilled]);
  useEffect(() => {
    // เปลี่ยน tab → set showBilled อัตโนมัติ
    if (viewMode === "history") setShowBilled(true);
    else setShowBilled(false);
  }, [viewMode]);
  useEffect(() => {
    // sync discount state เมื่อเปิด detail
    if (detailRow) {
      setEditingDiscount({
        amount: Number(detailRow.discount_amount || 0),
        note: detailRow.discount_note || "",
      });
    }
  }, [detailRow]);

  async function saveDiscount() {
    if (!detailRow) return;
    setSavingDiscount(true);
    try {
      await post({
        action: "save_submission_discount",
        submission_id: detailRow.submission_id,
        discount_amount: Number(editingDiscount.amount) || 0,
        discount_note: editingDiscount.note || "",
      });
      setMessage("✅ บันทึกส่วนลดเรียบร้อย");
      // refresh data
      fetchData();
      // update detailRow ใน UI
      const newDiscount = Number(editingDiscount.amount) || 0;
      const subtotal = Number(detailRow.subtotal_amount || detailRow.bill_amount || 0) + Number(detailRow.discount_amount || 0);
      setDetailRow({ ...detailRow, discount_amount: newDiscount, discount_note: editingDiscount.note, bill_amount: subtotal - newDiscount, subtotal_amount: subtotal });
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSavingDiscount(false);
  }

  function fmtBranch(code) {
    if (!code) return "-";
    return /^0+$/.test(String(code).trim()) ? "SCY01" : String(code).trim();
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (branchFilter && fmtBranch(r.branch_code) !== branchFilter) return false;
    if (runFilters.length > 0 && !runFilters.includes(r.run_code)) return false;
    if (!kw) return true;
    const hay = [r.customer_name, r.customer_phone, r.engine_no, r.chassis_no, r.plate_number, r.invoice_no, r.run_code]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  function toggleRun(code) {
    setRunFilters(rs => rs.includes(code) ? rs.filter(x => x !== code) : [...rs, code]);
  }

  const branchOpts = [...new Set(rows.map(r => fmtBranch(r.branch_code)).filter(v => v && v !== "-"))].sort();
  const runOpts = [...new Set(rows.map(r => r.run_code).filter(Boolean))].sort().reverse();
  const selectedRows = filtered.filter(r => selected[r.submission_id]);
  const selCount = selectedRows.length;
  const selTotal = selectedRows.reduce((sum, r) => sum + Number(r.bill_amount || 0), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.submission_id])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.submission_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.submission_id] = true; });
      setSelected(next);
    }
  }

  async function saveBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อน"); return; }
    const now = new Date();
    const docNo = `BILL-${(now.getFullYear() + 543).toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    if (!window.confirm(`บันทึกวางบิล ${selCount} รายการ\nหมวด: ${category}\nยอดรวม: ${selTotal.toLocaleString()} บาท\nเลขที่ใบ: ${docNo}`)) return;
    setSaving(true);
    setMessage("");
    try {
      // groupby brand to compute amount per row (each row's bill_amount)
      // backend stores billing_amount per submission
      await Promise.all(selectedRows.map(r =>
        post({
          action: "save_billing",
          submission_ids: [r.submission_id],
          billing_doc_no: docNo,
          category,
          amount: r.bill_amount || 0,
        })
      ));
      setMessage(`✅ บันทึกใบวางบิล ${docNo} สำเร็จ ${selCount} รายการ`);
      fetchData();
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  function printBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อนพิมพ์"); return; }
    const html = buildBillingHTML({ rows: selectedRows, brand, category, total: selTotal });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 วางบิล</h2>
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

      {/* Brand tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["ฮอนด้า", "ยามาฮ่า"].map(b => (
          <button key={b} onClick={() => setBrand(b)}
            style={{ padding: "10px 24px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15, fontWeight: 600,
              background: brand === b ? "#072d6b" : "#e5e7eb",
              color: brand === b ? "#fff" : "#374151" }}>
            {b}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>หมวดค่าใช้จ่าย:</label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 180 }}>
          {categoryOpts.length === 0 && <option value="">(ยังไม่มีหมวด)</option>}
          {categoryOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {viewMode === "pending" && (
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={showBilled} onChange={e => setShowBilled(e.target.checked)} />
            แสดงที่วางบิลแล้ว
          </label>
        )}

        <button onClick={fetchData}
          style={{ padding: "7px 12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🔄</button>
      </div>

      {/* Run filter chips — เฉพาะโหมด pending */}
      {viewMode === "pending" && runOpts.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <strong style={{ fontSize: 13, color: "#374151" }}>เลขที่ใบรับทะเบียน:</strong>
          {runOpts.map(r => {
            const active = runFilters.includes(r);
            const count = rows.filter(x => x.run_code === r).length;
            return (
              <button key={r} onClick={() => toggleRun(r)}
                style={{ padding: "5px 12px", border: "1px solid " + (active ? "#072d6b" : "#d1d5db"), background: active ? "#072d6b" : "#fff", color: active ? "#fff" : "#374151", borderRadius: 999, cursor: "pointer", fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>
                {active && "✓ "}{r} <span style={{ opacity: 0.7, fontFamily: "Tahoma", marginLeft: 4 }}>({count})</span>
              </button>
            );
          })}
          {runFilters.length > 0 && (
            <button onClick={() => setRunFilters([])}
              style={{ padding: "5px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>✕ ล้าง</button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
            {runFilters.length > 0 ? `เลือก ${runFilters.length} ใบ` : "(เลือกได้หลายใบ)"}
          </span>
        </div>
      )}

      {/* Action bar — เฉพาะโหมด pending */}
      {viewMode === "pending" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24" }}>
          <strong style={{ fontSize: 14, color: "#92400e" }}>
            เลือก {selCount} / {filtered.length} รายการ • ยอดรวม <span style={{ fontSize: 18 }}>{selTotal.toLocaleString()}</span> บาท
          </strong>
          <button onClick={printBilling} disabled={selCount === 0}
            style={{ marginLeft: "auto", padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: selCount === 0 ? "not-allowed" : "pointer", opacity: selCount === 0 ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 13, fontWeight: 600 }}>
            🖨️ พิมพ์ใบวางบิล
          </button>
          <button onClick={saveBilling} disabled={selCount === 0 || saving || showBilled}
            style={{ padding: "8px 18px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (selCount === 0 || saving || showBilled) ? "not-allowed" : "pointer", opacity: (selCount === 0 || saving || showBilled) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
            💾 {saving ? "กำลังบันทึก..." : "บันทึกวางบิล"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          {viewMode === "history" ? "ยังไม่มีใบวางบิล" : "ไม่มีรายการรอวางบิล (ทุกคันถูกวางบิลแล้ว หรือยังไม่มีรับคืนทะเบียน)"}
        </div>
      ) : viewMode === "history" ? (
        // ประวัติการวางบิล — group by billing_doc_no
        (() => {
          const grouped = {};
          filtered.forEach(r => {
            const key = r.billing_doc_no || "unknown";
            if (!grouped[key]) {
              grouped[key] = {
                billing_doc_no: key,
                billed_at: r.billed_at,
                items: [],
                total: 0,
              };
            }
            grouped[key].items.push(r);
            grouped[key].total += Number(r.bill_amount || 0);
          });
          const groups = Object.values(grouped).sort((a, b) => {
            const da = a.billed_at ? new Date(a.billed_at).getTime() : 0;
            const db = b.billed_at ? new Date(b.billed_at).getTime() : 0;
            return db - da;
          });
          return (
            <div>
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", display: "flex", gap: 18, fontSize: 13 }}>
                <span>📑 ใบวางบิล: <strong>{groups.length}</strong></span>
                <span>📋 รายการรวม: <strong>{filtered.length}</strong></span>
                <span>💰 ยอดรวม: <strong style={{ color: "#dc2626" }}>{groups.reduce((s, g) => s + g.total, 0).toLocaleString()}</strong></span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {groups.map(g => {
                  const open = !!historyExpanded[g.billing_doc_no];
                  return (
                    <div key={g.billing_doc_no} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                      <div onClick={() => setHistoryExpanded(prev => ({ ...prev, [g.billing_doc_no]: !prev[g.billing_doc_no] }))}
                        style={{ padding: "10px 14px", background: "linear-gradient(90deg,#072d6b 0%,#0e4ba8 100%)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 14 }}>{open ? "▾" : "▸"}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{g.billing_doc_no}</span>
                        <span style={{ background: "#fff3", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>
                          {g.billed_at ? new Date(g.billed_at).toLocaleString("th-TH") : "-"}
                        </span>
                        <span style={{ fontSize: 13 }}>📋 {g.items.length} รายการ</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>฿ {g.total.toLocaleString()}</span>
                        <button onClick={e => { e.stopPropagation(); printBilling(); }}
                          title="พิมพ์ซ้ำ ต้องเลือก checkbox ของรายการในใบนี้"
                          style={{ padding: "4px 10px", background: "#fff2", color: "#fff", border: "1px solid #fff5", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                          🖨️
                        </button>
                      </div>

                      {open && (
                        <table className="data-table">
                          <thead style={{ background: "#f3f4f6" }}>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              <th>เลขที่รับทะเบียน</th>
                              <th>ลูกค้า</th>
                              <th>เลขเครื่อง</th>
                              <th>หมวด</th>
                              <th>เลขทะเบียน</th>
                              <th>รายการค่าใช้จ่าย</th>
                              <th style={{ textAlign: "right" }}>ยอดรวม</th>
                              <th style={{ width: 60 }}>ดู</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((r, i) => {
                              const items = Array.isArray(r.bill_items) ? r.bill_items : (r.bill_items ? (typeof r.bill_items === "string" ? JSON.parse(r.bill_items) : r.bill_items) : []);
                              return (
                                <tr key={r.submission_id}>
                                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                                  <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#072d6b" }}>{r.run_code || "-"}</td>
                                  <td>{r.customer_name || "-"}</td>
                                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                                  <td>{r.plate_category || "-"}</td>
                                  <td style={{ fontWeight: 600 }}>{r.plate_number || "-"}</td>
                                  <td style={{ fontSize: 11 }}>
                                    {items.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span> : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        {items.map((it, idx) => (
                                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                                            <span style={{ color: it.group_by === "finance" ? "#7c3aed" : it.group_by === "province" ? "#0f766e" : it.group_by === "cc" ? "#dc2626" : "#1e3a8a" }}>
                                              {it.group_by === "finance" ? "💼 " : it.group_by === "province" ? "📍 " : it.group_by === "cc" ? "🏍️ " : ""}{it.expense_name}
                                            </span>
                                            <span style={{ fontWeight: 600, color: "#374151" }}>{Number(it.amount).toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: "#072d6b" }}>
                                    {r.bill_amount ? Number(r.bill_amount).toLocaleString() : "—"}
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <button onClick={() => setDetailRow(r)}
                                      style={{ padding: "4px 10px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                                      👁️
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
                            <tr>
                              <td colSpan={7} style={{ textAlign: "right", padding: "8px 12px" }}>รวม {g.items.length} รายการ</td>
                              <td style={{ textAlign: "right", padding: "8px 12px", color: "#dc2626", fontSize: 15 }}>{g.total.toLocaleString()}</td>
                              <td></td>
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
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.submission_id])} onChange={toggleAll} /></th>
                <th style={{ width: 40 }}>#</th>
                <th>เลขที่รับทะเบียน</th>
                <th>ลูกค้า</th>
                <th>เลขเครื่อง</th>
                <th>หมวด</th>
                <th>เลขทะเบียน</th>
                <th>รายการค่าใช้จ่าย</th>
                <th style={{ textAlign: "right" }}>ยอดรวม</th>
                {showBilled && <th>ใบวางบิล</th>}
                <th style={{ width: 60 }}>ดู</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const items = Array.isArray(r.bill_items) ? r.bill_items : (r.bill_items ? (typeof r.bill_items === "string" ? JSON.parse(r.bill_items) : r.bill_items) : []);
                return (
                <tr key={r.submission_id} style={{ background: selected[r.submission_id] ? "#eff6ff" : (r.billed_at ? "#f9fafb" : undefined), cursor: "pointer" }}
                  onClick={() => !showBilled && toggleOne(r.submission_id)}>
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    {!showBilled && <input type="checkbox" checked={!!selected[r.submission_id]} onChange={() => toggleOne(r.submission_id)} />}
                  </td>
                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#072d6b" }}>{r.run_code || "-"}</td>
                  <td>{r.customer_name || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                  <td>{r.plate_category || "-"}</td>
                  <td style={{ fontWeight: 600 }}>{r.plate_number || "-"}</td>
                  <td style={{ fontSize: 11 }}>
                    {items.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {items.map((it, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ color: it.group_by === "finance" ? "#7c3aed" : it.group_by === "province" ? "#0f766e" : it.group_by === "cc" ? "#dc2626" : "#1e3a8a" }}>
                              {it.group_by === "finance" ? "💼 " : it.group_by === "province" ? "📍 " : it.group_by === "cc" ? "🏍️ " : ""}{it.expense_name}
                            </span>
                            <span style={{ fontWeight: 600, color: "#374151" }}>{Number(it.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: r.bill_amount ? "#072d6b" : "#9ca3af" }}>
                    {r.bill_amount ? Number(r.bill_amount).toLocaleString() : "—"}
                  </td>
                  {showBilled && <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.billing_doc_no || "-"}</td>}
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDetailRow(r)}
                      style={{ padding: "4px 10px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                      👁️
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 700, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📄 รายละเอียด — {detailRow.run_code}</h3>
              <button onClick={() => setDetailRow(null)}
                style={{ marginLeft: "auto", padding: "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>✕</button>
            </div>

            <DetailSection title="ข้อมูลลูกค้า" items={[
              ["ชื่อลูกค้า", detailRow.customer_name],
              ["เบอร์โทร", detailRow.customer_phone, "mono"],
              ["เลขบัตรประชาชน", detailRow.id_card, "mono"],
              ["ที่อยู่", detailRow.address],
              ["ตำบล", detailRow.sub_district],
              ["อำเภอ", detailRow.district],
              ["จังหวัด", detailRow.customer_province],
              ["รหัสไปรษณีย์", detailRow.postal_code, "mono"],
            ]} />

            <DetailSection title="ข้อมูลรถ" items={[
              ["เลขที่ใบขาย", detailRow.invoice_no, "mono"],
              ["วันที่ขาย", detailRow.sale_date ? String(detailRow.sale_date).slice(0,10) : "-"],
              ["ยี่ห้อ", detailRow.brand],
              ["รุ่น", detailRow.model_series],
              ["CC", detailRow.engine_cc ? `${detailRow.engine_cc} cc` : "-"],
              ["สี", detailRow.color_name],
              ["เลขเครื่อง", detailRow.engine_no, "mono"],
              ["เลขถัง (VIN)", detailRow.chassis_no, "mono"],
              ["ไฟแนนท์", (detailRow.finance_company && detailRow.finance_company !== '-') ? detailRow.finance_company : "เงินสด"],
              ["สาขาที่ขาย", fmtBranch(detailRow.branch_code)],
            ]} />

            <DetailSection title="ข้อมูลทะเบียน" items={[
              ["เลขที่รับทะเบียน", detailRow.run_code, "mono"],
              ["หมวด", detailRow.plate_category],
              ["เลขทะเบียน", detailRow.plate_number, "bold"],
              ["จังหวัดทะเบียน", detailRow.plate_province],
              ["วันจดทะเบียน", detailRow.register_date ? String(detailRow.register_date).slice(0,10) : "-"],
              ["วันรับคืน", detailRow.received_at ? String(detailRow.received_at).slice(0,10) : "-"],
            ]} />

            {/* Bill Items */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 8px", color: "#374151", fontSize: 14 }}>💰 รายการค่าใช้จ่าย</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #e5e7eb" }}>รายการ</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", border: "1px solid #e5e7eb", width: 90 }}>กลุ่ม</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", border: "1px solid #e5e7eb", width: 90 }}>ยอด (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let items = [];
                    try { items = Array.isArray(detailRow.bill_items) ? detailRow.bill_items : (typeof detailRow.bill_items === "string" ? JSON.parse(detailRow.bill_items) : []); } catch {}
                    return items.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: "center", padding: 16, color: "#9ca3af" }}>ไม่มีรายการ</td></tr>
                    ) : items.map((it, i) => {
                      const groupColor = it.group_by === "finance" ? "#7c3aed" : it.group_by === "province" ? "#0f766e" : it.group_by === "cc" ? "#dc2626" : "#1e3a8a";
                      const groupLabel = it.group_by === "finance" ? "ไฟแนนท์" : it.group_by === "province" ? "จังหวัด" : it.group_by === "cc" ? "CC" : "ยี่ห้อ";
                      return (
                        <tr key={i}>
                          <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>{it.expense_name}</td>
                          <td style={{ padding: "6px 10px", textAlign: "center", border: "1px solid #e5e7eb", color: groupColor, fontSize: 11, fontWeight: 600 }}>{groupLabel}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", border: "1px solid #e5e7eb", fontWeight: 600 }}>{Number(it.amount).toLocaleString()}</td>
                        </tr>
                      );
                    });
                  })()}
                  {(() => {
                    const subtotal = Number(detailRow.subtotal_amount || 0) || (Number(detailRow.bill_amount || 0) + Number(detailRow.discount_amount || 0));
                    const discount = Number(editingDiscount.amount) || 0;
                    const net = subtotal - discount;
                    const isLocked = !!detailRow.billed_at;  // วางบิลแล้ว → ห้ามแก้
                    return (
                      <>
                        <tr style={{ background: "#f3f4f6" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #d1d5db", fontWeight: 600 }}>รวม</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #d1d5db", fontWeight: 600 }}>{subtotal.toLocaleString()}</td>
                        </tr>
                        <tr style={{ background: "#fee2e2" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fca5a5", fontWeight: 600, color: "#991b1b" }}>
                            <span style={{ marginRight: 8 }}>ส่วนลด</span>
                            <input type="number" step="0.01" min="0" max={subtotal}
                              value={editingDiscount.amount}
                              onChange={e => setEditingDiscount(p => ({ ...p, amount: e.target.value }))}
                              disabled={isLocked}
                              style={{ width: 100, padding: "3px 6px", textAlign: "right", border: "1px solid #fca5a5", borderRadius: 4, fontFamily: "monospace", background: isLocked ? "#f3f4f6" : "#fff" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fca5a5", fontWeight: 600, color: "#991b1b" }}>−{discount.toLocaleString()}</td>
                        </tr>
                        <tr style={{ background: "#fef3c7" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fbbf24", fontWeight: 700 }}>ยอดสุทธิ</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fbbf24", fontWeight: 700, fontSize: 16, color: "#072d6b" }}>{net.toLocaleString()}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>

              {/* discount note + save button */}
              {!detailRow.billed_at && (
                <div style={{ marginTop: 8, padding: "10px 12px", background: "#fef9c3", borderRadius: 6, border: "1px solid #fbbf24" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>หมายเหตุส่วนลด (ถ้ามี)</label>
                  <input type="text" value={editingDiscount.note}
                    onChange={e => setEditingDiscount(p => ({ ...p, note: e.target.value }))}
                    placeholder="เช่น ลดให้ลูกค้าประจำ, เคสพิเศษ"
                    style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button onClick={saveDiscount} disabled={savingDiscount || Number(editingDiscount.amount) === Number(detailRow.discount_amount || 0) && editingDiscount.note === (detailRow.discount_note || "")}
                      style={{ padding: "6px 16px", background: savingDiscount ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: savingDiscount ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                      {savingDiscount ? "กำลังบันทึก..." : "💾 บันทึกส่วนลด"}
                    </button>
                  </div>
                </div>
              )}
              {detailRow.billed_at && detailRow.discount_note && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef9c3", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
                  💬 หมายเหตุส่วนลด: {detailRow.discount_note}
                </div>
              )}
            </div>

            {detailRow.billed_at && (
              <DetailSection title="ข้อมูลการวางบิล" items={[
                ["เลขที่ใบวางบิล", detailRow.billing_doc_no, "mono"],
                ["วันที่วางบิล", detailRow.billed_at ? new Date(detailRow.billed_at).toLocaleString("th-TH") : "-"],
              ]} />
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setDetailRow(null)}
                style={{ padding: "8px 24px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, items }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "0 0 8px", color: "#374151", fontSize: 14 }}>{title}</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        {items.map(([label, val, type], i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
            <span style={{ color: "#6b7280", minWidth: 90 }}>{label}:</span>
            <span style={{ color: "#111", fontWeight: type === "bold" ? 700 : 400, fontFamily: type === "mono" ? "monospace" : "Tahoma", fontSize: type === "mono" ? 12 : 13 }}>
              {val || <span style={{ color: "#d1d5db" }}>—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildBillingHTML({ rows, brand, category, total }) {
  const today = new Date();
  const dstr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear() + 543}`;
  const safe = s => s === null || s === undefined ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tr = rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${safe(r.customer_name)}</td>
      <td>${safe(r.invoice_no)}</td>
      <td class="mono">${safe(r.engine_no)}</td>
      <td class="c">${safe(r.plate_category)} ${safe(r.plate_number)}</td>
      <td class="r b">${Number(r.bill_amount || 0).toLocaleString()}</td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบวางบิล ${safe(brand)} - ${safe(category)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Sarabun","Tahoma",sans-serif; font-size: 13px; color: #111; margin: 0; }
  .doc { max-width: 297mm; margin: 0 auto; }
  .header { border-bottom: 3px double #1e3a8a; padding-bottom: 8px; margin-bottom: 14px; text-align: center; }
  .header h1 { margin: 0; color: #1e3a8a; font-size: 20px; }
  .header .sub { font-size: 13px; color: #6b7280; margin-top: 3px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 12px; padding: 10px 14px; background: #f8fafc; border-left: 3px solid #1e3a8a; border-radius: 4px; }
  .meta div { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #1e3a8a; color: #fff; padding: 8px 6px; text-align: center; }
  tbody td { border: 1px solid #cbd5e1; padding: 6px 8px; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { border-top: 2px solid #1e3a8a; padding: 10px 8px; font-weight: 700; font-size: 14px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .mono { font-family: "Consolas",monospace; font-size: 11px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
  .sign-box { text-align: center; font-size: 13px; }
  .sign-line { border-top: 1px dotted #111; padding-top: 6px; }
</style></head><body>
<div class="doc">
  <div class="header">
    <h1>ใบวางบิลค่าจดทะเบียน — ${safe(brand)}</h1>
    <div class="sub">หมวด: ${safe(category)}</div>
  </div>
  <div class="meta">
    <div><strong>วันที่:</strong> ${dstr}</div>
    <div><strong>จำนวน:</strong> ${rows.length} รายการ</div>
    <div><strong>ยอดรวม:</strong> ${total.toLocaleString()} บาท</div>
  </div>
  <table>
    <thead><tr>
      <th style="width:36px">#</th>
      <th>ชื่อลูกค้า</th>
      <th>เลขที่ใบขาย</th>
      <th>เลขเครื่อง</th>
      <th>เลขทะเบียน</th>
      <th style="width:100px">ยอดเงิน (บาท)</th>
    </tr></thead>
    <tbody>${tr}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right">รวมทั้งสิ้น</td>
        <td style="text-align:right">${total.toLocaleString()} บาท</td>
      </tr>
    </tfoot>
  </table>
  <div class="sign">
    <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้วางบิล</div></div>
    <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้รับวางบิล</div></div>
  </div>
</div>
</body></html>`;
}
