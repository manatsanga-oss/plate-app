import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const PLAN_OPTS = [
  { key: "rsa",           label: "RSA (ช่วยเหลือฉุกเฉิน)",     color: "#1565c0" },
  { key: "pa",            label: "PA (อุบัติเหตุส่วนบุคคล)",    color: "#2e7d32" },
  { key: "3plus",         label: "3 PLUS",                       color: "#7b1fa2" },
  { key: "theft",         label: "ประกันรถหาย",                color: "#c62828" },
  { key: "theft_renewal", label: "ประกันรถหายปีต่อ",          color: "#ea580c" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()+543}`;
}

export default function CosmosBillingPage({ currentUser }) {
  const [mode, setMode] = useState("payment");
  const [message, setMessage] = useState("");
  const currentPlan = { color: "#1565c0" }; // สีหลักของหน้า (ไม่กรองตาม plan)

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 วางบิล ประกัน COSMOS</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["payment", "💵 บันทึกจ่ายเงิน"],
          ["history", "📋 ประวัติการจ่ายเงิน"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => { setMode(v); setMessage(""); }}
            style={{ padding: "10px 20px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: mode === v ? "#072d6b" : "#6b7280",
              borderBottom: mode === v ? "3px solid #072d6b" : "3px solid transparent",
              marginBottom: -2 }}>{label}</button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>
      )}

      {mode === "payment" && <PaymentPanel currentPlan={currentPlan} setMessage={setMessage} currentUser={currentUser} />}
      {mode === "history" && <HistoryPanel currentPlan={currentPlan} setMessage={setMessage} />}
    </div>
  );
}

/* ======================== TAB: รอวางบิล ======================== */
function PendingPanel({ plan, currentPlan, setMessage, currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); setSelected(new Set()); /* eslint-disable-next-line */ }, [plan]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_pending_billing", plan }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  function toggle(id) {
    setSelected(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  }
  function toggleAll() {
    setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  }

  const selRows = rows.filter(r => selected.has(r.id));
  const selSum = selRows.reduce((s, r) => s + Number(r.premium || 0), 0);

  async function saveBilling() {
    if (selRows.length === 0) { setMessage("⚠️ กรุณาเลือกรายการ"); return; }
    if (!window.confirm(`สร้างใบวางบิลสำหรับ ${selRows.length} รายการ ยอดรวม ${fmt(selSum)} บาท?`)) return;
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_cosmos_billing",
          plan,
          submission_ids: Array.from(selected),
          billed_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      setMessage(`✅ สร้างใบวางบิล ${data.billing_doc_no || ""} (${data.count || 0} รายการ)`);
      setSelected(new Set());
      fetchData();
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, alignItems: "center" }}>
        <span>📋 รวม: <strong>{rows.length}</strong> รายการ</span>
        <span style={{ color: "#7c3aed" }}>☑️ เลือก: <strong>{selected.size}</strong></span>
        <span style={{ color: currentPlan.color }}>💰 ยอด: <strong>{fmt(selSum)}</strong></span>
        <button onClick={fetchData} style={btn(currentPlan.color)}>🔄 รีเฟรช</button>
        <button onClick={saveBilling} disabled={saving || selected.size === 0} style={{ ...btn("#059669"), opacity: selected.size === 0 ? 0.5 : 1, marginLeft: "auto" }}>
          📝 สร้างใบวางบิล ({selected.size})
        </button>
      </div>
      <Table rows={rows} loading={loading} selected={selected} toggle={toggle} toggleAll={toggleAll} color={currentPlan.color} />
    </div>
  );
}

/* ======================== TAB: บันทึกจ่ายเงิน ======================== */
function PaymentPanel({ currentPlan, setMessage, currentUser }) {
  const [bills, setBills] = useState([]); // grouped by billing_doc_no
  const [loading, setLoading] = useState(false);
  const [selDocs, setSelDocs] = useState(new Set());
  const [showPay, setShowPay] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payForm, setPayForm] = useState({ paid_date: "", payment_method: "โอน", paid_to_vendor: "", payment_note: "", wht_rate: 0, wht_amount: 0, wht_base: 0, from_bank_account_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); fetchVendors(); fetchBanks(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_billed" }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      // group by batch_no (= ใบวางบิล)
      const groups = {};
      rows.forEach(r => {
        if (!groups[r.batch_no]) groups[r.batch_no] = { batch_no: r.batch_no, billed_at: r.submitted_at, items: [], total: 0 };
        groups[r.batch_no].items.push(r);
        groups[r.batch_no].total += Number(r.premium) || 0;
      });
      setBills(Object.values(groups));
    } catch { setBills([]); }
    setLoading(false);
  }

  async function fetchVendors() {
    try {
      const res = await fetch(MASTER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }) });
      const d = await res.json(); setVendors(Array.isArray(d) ? d : []);
    } catch {}
  }
  async function fetchBanks() {
    try {
      const res = await fetch(ACC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) });
      const d = await res.json(); setBankAccounts(Array.isArray(d) ? d : []);
    } catch {}
  }

  function toggleDoc(no) { setSelDocs(s => { const ns = new Set(s); ns.has(no) ? ns.delete(no) : ns.add(no); return ns; }); }
  const selectedTotal = bills.filter(b => selDocs.has(b.batch_no)).reduce((s, b) => s + b.total, 0);

  function openPayDialog() {
    if (selDocs.size === 0) { setMessage("⚠️ กรุณาเลือกใบวางบิล"); return; }
    setPayForm({ paid_date: new Date().toISOString().slice(0,10), payment_method: "โอน", paid_to_vendor: "", payment_note: "", wht_rate: 0, wht_amount: 0, wht_base: selectedTotal, from_bank_account_id: "" });
    setShowPay(true);
  }

  function onVendorChange(name) {
    const v = vendors.find(x => x.vendor_name === name);
    const rate = v ? Number(v.wht_rate || 0) : 0;
    const amt = rate > 0 ? Math.round((selectedTotal * rate / 100) * 100) / 100 : 0;
    setPayForm(p => ({ ...p, paid_to_vendor: name, wht_rate: rate, wht_amount: amt, wht_base: selectedTotal }));
  }

  async function submitPay() {
    if (!payForm.paid_to_vendor) { setMessage("❌ เลือก Vendor"); return; }
    if (!payForm.from_bank_account_id) { setMessage("❌ เลือกบัญชีโอนจาก"); return; }
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_cosmos_payment",
          batch_nos: Array.from(selDocs),
          paid_date: payForm.paid_date,
          payment_method: payForm.payment_method,
          payment_note: payForm.payment_note,
          paid_to_vendor: payForm.paid_to_vendor,
          wht_rate: Number(payForm.wht_rate) || 0,
          wht_amount: Number(payForm.wht_amount) || 0,
          wht_base: Number(payForm.wht_base) || 0,
          from_bank_account_id: Number(payForm.from_bank_account_id) || null,
          paid_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      setMessage(`✅ บันทึกจ่ายเงิน ${data.paid_doc_no || ""} (${data.updated_count || 0} รายการ)`);
      setShowPay(false);
      setSelDocs(new Set());
      fetchData();
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, alignItems: "center" }}>
        <span>📦 Batch รอจ่าย: <strong>{bills.length}</strong></span>
        <span style={{ color: "#7c3aed" }}>☑️ เลือก: <strong>{selDocs.size}</strong></span>
        <span style={{ color: currentPlan.color }}>💰 ยอด: <strong>{fmt(selectedTotal)}</strong></span>
        <button onClick={fetchData} style={btn(currentPlan.color)}>🔄 รีเฟรช</button>
        <button onClick={openPayDialog} disabled={selDocs.size === 0} style={{ ...btn("#059669"), opacity: selDocs.size === 0 ? 0.5 : 1, marginLeft: "auto" }}>
          💵 บันทึกจ่ายเงิน ({selDocs.size})
        </button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       bills.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มี Batch ที่รอจ่าย</div> :
       bills.map(b => {
        // ใช้ plan ของรายการแรก (1 batch = 1 plan)
        const planKey = b.items[0]?.plan || "rsa";
        const planOpt = PLAN_OPTS.find(p => p.key === planKey) || PLAN_OPTS[0];
        const isSel = selDocs.has(b.batch_no);
        return (
          <label key={b.batch_no}
            style={{ marginBottom: 12, border: `2px solid ${isSel ? planOpt.color : "#e5e7eb"}`, borderRadius: 10, background: isSel ? "#fef3c7" : "#fff", overflow: "hidden", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer" }}>
            <input type="checkbox" checked={isSel} onChange={() => toggleDoc(b.batch_no)}
              style={{ width: 22, height: 22, cursor: "pointer", accentColor: planOpt.color }} />
            <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700, background: planOpt.color, color: "#fff", minWidth: 60, textAlign: "center", textTransform: "uppercase" }}>
              {planKey}
            </span>
            <strong style={{ fontFamily: "monospace", color: planOpt.color, fontSize: 14 }}>{b.batch_no}</strong>
            <span style={{ fontSize: 12, color: "#6b7280" }}>📅 {fmtDate(b.billed_at)}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15, color: planOpt.color }}>
              {b.items.length} รายการ · <span style={{ fontSize: 17 }}>{fmt(b.total)}</span> บาท
            </span>
          </label>
        );
      })}

      {showPay && (
        <PaymentDialog payForm={payForm} setPayForm={setPayForm} vendors={vendors} bankAccounts={bankAccounts}
          onVendorChange={onVendorChange} totalSum={selectedTotal} onClose={() => setShowPay(false)}
          onSave={submitPay} saving={saving} numDocs={selDocs.size} />
      )}
    </div>
  );
}

/* ======================== TAB: ประวัติการจ่ายเงิน ======================== */
function HistoryPanel({ currentPlan, setMessage }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openSet, setOpenSet] = useState(new Set());

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_paid" }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      // group by paid_doc_no
      const g = {};
      rows.forEach(r => {
        if (!g[r.paid_doc_no]) g[r.paid_doc_no] = {
          paid_doc_no: r.paid_doc_no, paid_at: r.paid_at, paid_to_vendor: r.paid_to_vendor,
          payment_method: r.payment_method, payment_note: r.payment_note,
          bank_account_name: r.bank_account_name, bank_name: r.bank_name, bank_account_no: r.bank_account_no,
          items: [], total: 0, wht: Number(r.wht_amount || 0)
        };
        g[r.paid_doc_no].items.push(r);
        g[r.paid_doc_no].total += Number(r.premium) || 0;
      });
      setGroups(Object.values(g));
    } catch { setGroups([]); }
    setLoading(false);
  }

  function toggleOpen(docNo) {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(docNo)) next.delete(docNo); else next.add(docNo);
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <span>💵 ใบจ่ายเงิน: <strong>{groups.length}</strong></span>
        <span style={{ color: currentPlan.color }}>💰 ยอดรวม: <strong>{fmt(groups.reduce((s, g) => s + g.total, 0))}</strong></span>
        <button onClick={fetchData} style={{ ...btn(currentPlan.color), marginLeft: "auto" }}>🔄 รีเฟรช</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       groups.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติการจ่าย</div> :
       groups.map(g => {
        const isOpen = openSet.has(g.paid_doc_no);
        return (
        <div key={g.paid_doc_no} style={{ marginBottom: 12, background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, overflow: "hidden" }}>
          <div onClick={() => toggleOpen(g.paid_doc_no)}
               style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
               title="คลิกเพื่อดูรายละเอียดใบโอนเงิน">
            <span style={{ fontSize: 14, color: "#065f46", width: 14 }}>{isOpen ? "▼" : "▶"}</span>
            <strong style={{ fontFamily: "monospace", color: "#065f46", fontSize: 15 }}>{g.paid_doc_no}</strong>
            <span style={{ fontSize: 12 }}>📅 {fmtDate(g.paid_at)}</span>
            <span style={{ fontSize: 12 }}>👤 {g.paid_to_vendor || "-"}</span>
            <span style={{ fontSize: 12 }}>💰 {g.payment_method || "-"}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 16, color: "#065f46" }}>{g.items.length} ใบ · {fmt(g.total)}</span>
            {g.wht > 0 && <span style={{ fontSize: 12, color: "#dc2626" }}>WHT: {fmt(g.wht)}</span>}
          </div>

          {isOpen && (
            <div style={{ borderTop: "1px solid #6ee7b7", background: "#fff", padding: "12px 16px" }}>
              {/* บันทึกการโอนเงิน — info block */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12, padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12 }}>
                <div><b>💳 วิธีจ่าย:</b> {g.payment_method || "-"}</div>
                <div><b>👤 จ่ายให้:</b> {g.paid_to_vendor || "-"}</div>
                <div><b>🏦 ธนาคาร:</b> {g.bank_name ? `${g.bank_name}${g.bank_account_no ? ` — ${g.bank_account_no}` : ""}` : "-"}</div>
                <div><b>📋 บัญชี:</b> {g.bank_account_name || "-"}</div>
                <div><b>💸 WHT:</b> {g.wht > 0 ? fmt(g.wht) : "—"}</div>
                {g.payment_note && <div style={{ gridColumn: "1 / -1" }}><b>📝 หมายเหตุ:</b> {g.payment_note}</div>}
              </div>

              {/* รายการใบวางบิลในใบโอน */}
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: currentPlan.color, color: "#fff" }}>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>App No.</th>
                      <th style={th}>ลูกค้า</th>
                      <th style={th}>เลขถัง</th>
                      <th style={th}>แผน</th>
                      <th style={th}>🚗 ใบขาย</th>
                      <th style={th}>📋 ใบรับเรื่อง</th>
                      <th style={{ ...th, textAlign: "right" }}>เบี้ย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((r, i) => (
                      <tr key={r.id || `${g.paid_doc_no}-${i}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: currentPlan.color }}>{r.app_no}</td>
                        <td style={td}>{r.customer_name || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
                        <td style={td}>{r.plan_name || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.invoice_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#7c3aed" }}>{r.receipt_no || "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(r.premium)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f0fdf4", fontWeight: 700 }}>
                      <td style={td} colSpan={7}>รวม {g.items.length} รายการ</td>
                      <td style={{ ...td, textAlign: "right", color: "#065f46" }}>{fmt(g.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

/* ======================== Components ======================== */
function Table({ rows, loading, selected, toggle, toggleAll, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       rows.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
       <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: color, color: "#fff" }}>
          <tr>
            <th style={{ padding: 10, width: 40, textAlign: "center" }}><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
            <th style={th}>#</th>
            <th style={th}>App No.</th>
            <th style={th}>วันที่</th>
            <th style={th}>ลูกค้า</th>
            <th style={th}>เลขถัง</th>
            <th style={th}>แผน</th>
            <th style={th}>เบี้ย</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: selected.has(r.id) ? "#fef3c7" : "transparent" }}>
              <td style={{ textAlign: "center" }}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color }}>{r.app_no}</td>
              <td style={td}>{fmtDate(r.submitted_at)}</td>
              <td style={td}>{r.customer_name || "-"}</td>
              <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
              <td style={td}>{r.plan_name || "-"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(r.premium)}</td>
            </tr>
          ))}
        </tbody>
      </table>}
    </div>
  );
}

function PaymentDialog({ payForm, setPayForm, vendors, bankAccounts, onVendorChange, totalSum, onClose, onSave, saving, numDocs }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>💵 บันทึกจ่ายเงิน</h3>
        <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, textAlign: "center" }}>
          <div>📑 ใบวางบิล: <b>{numDocs}</b> ใบ</div>
          <div>💰 ยอดรวม: <b style={{ color: "#dc2626", fontSize: 20 }}>฿ {fmt(totalSum)}</b></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>วันที่จ่าย *</label><input type="date" value={payForm.paid_date} onChange={e => setPayForm(p => ({ ...p, paid_date: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>วิธีจ่าย</label>
            <select value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} style={inp}>
              <option value="โอน">โอน</option><option value="เงินสด">เงินสด</option><option value="เช็ค">เช็ค</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / span 2" }}><label style={lbl}>Vendor *</label>
            <select value={payForm.paid_to_vendor} onChange={e => onVendorChange(e.target.value)} style={inp}>
              <option value="">-- เลือก Vendor --</option>
              {vendors.map(v => <option key={v.vendor_id} value={v.vendor_name}>{v.vendor_name}{v.wht_rate ? ` (${v.wht_rate}%)` : ""}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / span 2" }}><label style={lbl}>หมายเหตุ</label>
            <textarea value={payForm.payment_note} onChange={e => setPayForm(p => ({ ...p, payment_note: e.target.value }))} rows={2} style={inp} />
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6, textAlign: "center" }}>🏦 บัญชีธนาคาร</div>
          <label style={{ ...lbl, color: "#1e40af" }}>โอนจาก (บัญชีบริษัท) *</label>
          <select value={payForm.from_bank_account_id} onChange={e => setPayForm(p => ({ ...p, from_bank_account_id: e.target.value }))} style={inp}>
            <option value="">-- เลือกบัญชี --</option>
            {bankAccounts.map(b => <option key={b.account_id} value={b.account_id}>{b.bank_name} · {b.account_no} · {b.account_name}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6, textAlign: "center" }}>🧾 หักณที่จ่าย</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div><label style={{ fontSize: 11 }}>Base</label><input type="text" value={fmt(payForm.wht_base)} readOnly style={{ ...inp, textAlign: "right" }} /></div>
            <div><label style={{ fontSize: 11 }}>อัตรา %</label><input type="number" step="0.01" value={payForm.wht_rate} onChange={e => { const r = Number(e.target.value)||0; setPayForm(p => ({ ...p, wht_rate: r, wht_amount: Math.round((p.wht_base*r/100)*100)/100 })); }} style={{ ...inp, textAlign: "right" }} /></div>
            <div><label style={{ fontSize: 11 }}>หัก ณ ที่จ่าย</label><input type="number" step="0.01" value={payForm.wht_amount} onChange={e => setPayForm(p => ({ ...p, wht_amount: Number(e.target.value)||0 }))} style={{ ...inp, textAlign: "right", fontWeight: 700, color: "#dc2626" }} /></div>
          </div>
          <div style={{ marginTop: 8, padding: "6px 10px", background: "#fff", borderRadius: 6, fontSize: 13, textAlign: "center" }}>
            ยอดวางบิล: <b>{fmt(totalSum)}</b> − WHT: <b style={{ color: "#dc2626" }}>{fmt(payForm.wht_amount)}</b> = ยอดโอนจริง: <b style={{ color: "#059669" }}>{fmt(totalSum - Number(payForm.wht_amount || 0))}</b>
          </div>
        </div>

        <div style={{ marginTop: 18, textAlign: "right" }}>
          <button onClick={onClose} style={{ ...btn("#9ca3af"), marginRight: 8 }}>ยกเลิก</button>
          <button onClick={onSave} disabled={saving} style={btn("#059669")}>{saving ? "..." : "💾 บันทึก"}</button>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "Tahoma" });
