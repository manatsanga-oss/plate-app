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
  const [showBilled, setShowBilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  function fmtBranch(code) {
    if (!code) return "-";
    return /^0+$/.test(String(code).trim()) ? "SCY01" : String(code).trim();
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (branchFilter && fmtBranch(r.branch_code) !== branchFilter) return false;
    if (!kw) return true;
    const hay = [r.customer_name, r.customer_phone, r.engine_no, r.chassis_no, r.plate_number, r.invoice_no, r.run_code]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const branchOpts = [...new Set(rows.map(r => fmtBranch(r.branch_code)).filter(v => v && v !== "-"))].sort();
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
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>หมวดค่าใช้จ่าย:</label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 180 }}>
          {categoryOpts.length === 0 && <option value="">(ยังไม่มีหมวด)</option>}
          {categoryOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
          <option value="">ร้านที่ขาย (ทุกสาขา)</option>
          {branchOpts.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ลูกค้า / VIN / เลขเครื่อง / ทะเบียน"
          style={{ flex: 1, minWidth: 180, padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showBilled} onChange={e => setShowBilled(e.target.checked)} />
          แสดงที่วางบิลแล้ว
        </label>

        <button onClick={fetchData}
          style={{ padding: "7px 12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🔄</button>
      </div>

      {/* Action bar */}
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

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          {showBilled ? "ไม่มีรายการที่วางบิลแล้ว" : "ไม่มีรายการรอวางบิล (ทุกคันถูกวางบิลแล้ว หรือยังไม่มีรับคืนทะเบียน)"}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.submission_id])} onChange={toggleAll} /></th>
                <th style={{ width: 40 }}>#</th>
                <th>ลูกค้า</th>
                <th>เลขเครื่อง</th>
                <th>หมวด</th>
                <th>เลขทะเบียน</th>
                <th>รายการค่าใช้จ่าย</th>
                <th style={{ textAlign: "right" }}>ยอดรวม</th>
                {showBilled && <th>ใบวางบิล</th>}
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
                  <td>{r.customer_name || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                  <td>{r.plate_category || "-"}</td>
                  <td style={{ fontWeight: 600 }}>{r.plate_number || "-"}</td>
                  <td style={{ fontSize: 11 }}>
                    {items.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {items.map((it, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ color: it.group_by === "finance" ? "#7c3aed" : "#1e3a8a" }}>
                              {it.group_by === "finance" ? "💼 " : ""}{it.expense_name}
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
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
