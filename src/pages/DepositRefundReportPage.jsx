import React, { useState, useEffect, useMemo } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

// บันทึกคืนเงินมัดจำเป็นเงินโอน — daily_expenses เฉพาะหมวด "เงินมัดจำทั่วไป" ที่จ่ายด้วยเงินโอน
const CATEGORY_KW = "เงินมัดจำทั่วไป";

function fmt(v, d = 2) { const n = Number(v) || 0; return n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtInt(v) { return (Number(v) || 0).toLocaleString("th-TH"); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function postAPI(body) {
  const res = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function DepositRefundReportPage({ currentUser }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branch, setBranch] = useState("");
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState([]);      // deposit_refund_transfers ที่บันทึกแล้ว
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);    // { row, transfer_date, bank_account_id, note }
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [data, savedData] = await Promise.all([
        postAPI({ action: "list_daily_expenses", date_from: dateFrom, date_to: dateTo }),
        postAPI({ action: "list_deposit_refund_transfers", date_from: dateFrom, date_to: dateTo }),
      ]);
      setRows(Array.isArray(data) ? data : []);
      setSaved(Array.isArray(savedData) ? savedData : []);
    } catch { setRows([]); setSaved([]); }
    setLoading(false);
  }
  async function loadBanks() {
    try {
      const data = await postAPI({ action: "list_bank_accounts" });
      setBanks(Array.isArray(data) ? data : []);
    } catch { setBanks([]); }
  }
  useEffect(() => { load(); loadBanks(); /* eslint-disable-next-line */ }, []);

  const savedByNo = useMemo(() => {
    const m = new Map();
    for (const s of saved) m.set(s.payment_no, s);
    return m;
  }, [saved]);

  function openSave(r) {
    setModal({
      row: r,
      transfer_date: String(r.payment_date || "").slice(0, 10) || todayISO(), // default = วันที่ใบจ่าย
      bank_account_id: "",
      note: "",
    });
  }

  async function doSave() {
    if (!modal) return;
    if (!modal.bank_account_id) { alert("กรุณาเลือกบัญชีที่ใช้โอน"); return; }
    setSaving(true);
    try {
      const r = modal.row;
      await postAPI({
        action: "save_deposit_refund_transfer",
        payment_no: r.payment_no,
        payment_date: String(r.payment_date || "").slice(0, 10),
        pay_to: r.pay_to || "",
        detail: r.detail || "",
        amount: Number(r.transfer) || 0,
        transfer_date: modal.transfer_date,
        from_bank_account_id: Number(modal.bank_account_id),
        note: modal.note || "",
        created_by: currentUser?.name || currentUser?.username || "",
      });
      setModal(null);
      await load();
    } catch { alert("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function doCancel(s) {
    if (!window.confirm(`ยกเลิกการบันทึกตัดบัญชีของ ${s.payment_no}?`)) return;
    try {
      await postAPI({ action: "cancel_deposit_refund_transfer", id: s.id });
      await load();
    } catch { alert("ยกเลิกไม่สำเร็จ"); }
  }

  // เฉพาะหมวดเงินมัดจำทั่วไป + จ่ายด้วยเงินโอน
  const base = useMemo(() =>
    rows.filter(r => String(r.payment_type || "").includes(CATEGORY_KW) && (Number(r.transfer) || 0) > 0),
  [rows]);

  const branches = useMemo(() => {
    const s = new Set(base.map(r => r.branch_code).filter(Boolean));
    return Array.from(s).sort();
  }, [base]);

  const filtered = useMemo(() => {
    let out = base;
    if (branch) out = out.filter(r => r.branch_code === branch);
    if (search.trim()) {
      const s = search.toLowerCase();
      out = out.filter(r => {
        const blob = [r.payment_no, r.pay_to, r.detail, r.note].filter(Boolean).join(" ").toLowerCase();
        return blob.includes(s);
      });
    }
    return out;
  }, [base, branch, search]);

  const summary = useMemo(() => ({
    count: filtered.length,
    transfer: filtered.reduce((s, r) => s + (Number(r.transfer) || 0), 0),
    total: filtered.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
  }), [filtered]);

  const color = "#0f766e";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 บันทึกคืนเงินมัดจำเป็นเงินโอน</h2>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
        ข้อมูลจากใบสำคัญจ่ายรายวัน (daily_expenses) · เฉพาะหมวด "เงินมัดจำทั่วไป" ที่จ่ายด้วยเงินโอน · ไม่รวมรายการที่ยกเลิก · กด "บันทึก" เลือกบัญชีที่ใช้โอน แล้วรายการจะแสดงในรายงานการเคลื่อนไหวของบัญชีนั้น
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontWeight: 600 }}>📅 ช่วงเวลา:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <select value={branch} onChange={e => setBranch(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}>
          <option value="">ทุกสาขา</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (เลขที่จ่าย / ผู้รับ / รายละเอียด)"
          style={{ flex: 1, minWidth: 200, padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 20px", background: loading ? "#9ca3af" : color, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "⏳ โหลด..." : "🔍 ค้นหา"}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
        <KPI label="📋 จำนวนรายการ" value={fmtInt(summary.count)} unit="รายการ" color="#0369a1" />
        <KPI label="🏦 ยอดเงินโอน" value={fmt(summary.transfer)} unit="บาท" color="#7c3aed" />
        <KPI label="✅ รวมทั้งสิ้น" value={fmt(summary.total)} unit="บาท" color={color} />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: `2px solid ${color}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: color, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          💸 รายการคืนเงินมัดจำ (เงินโอน) — {fmtInt(filtered.length)} รายการ
        </div>
        <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>เลขที่จ่าย</th>
                <th style={th}>วันที่</th>
                <th style={th}>สาขา</th>
                <th style={th}>ผู้รับเงิน</th>
                <th style={th}>รายละเอียด</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดเงินโอน</th>
                <th style={{ ...th, textAlign: "right" }}>รวมทั้งสิ้น</th>
                <th style={th}>ผู้ทำรายการ</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}>ตัดบัญชี</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
              ) : filtered.map((r, i) => {
                const s = savedByNo.get(r.payment_no);
                return (
                <tr key={r.payment_no + "_" + i} style={{ borderTop: "1px solid #f3f4f6", background: s ? "#f0fdf4" : "transparent" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.payment_no}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.payment_date)}</td>
                  <td style={td}>{r.branch_code || "-"}</td>
                  <td style={td}>{(r.pay_to || "-").slice(0, 40)}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{(r.detail || "-").slice(0, 40)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#7c3aed" }}>{fmt(r.transfer)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#059669" }}>{fmt(r.total_amount)}</td>
                  <td style={td}>{r.prepared_by || "-"}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{(r.note || "-").slice(0, 30)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {s ? (
                      <span>
                        <span style={{ color: "#059669", fontWeight: 700 }}>✓ {[s.bank_name, s.account_name].filter(Boolean).join(" ")}</span>
                        <span style={{ color: "#6b7280", marginLeft: 6 }}>({fmtDate(s.transfer_date)})</span>
                        <button onClick={() => doCancel(s)} title="ยกเลิกการตัดบัญชี"
                          style={{ marginLeft: 8, padding: "2px 8px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                          ยกเลิก
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => openSave(r)}
                        style={{ padding: "4px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        💾 บันทึก
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal บันทึกตัดบัญชี */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={() => !saving && setModal(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, width: 440, maxWidth: "92vw" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: "#0f766e" }}>💾 บันทึกตัดบัญชี — คืนเงินมัดจำ</div>
            <div style={{ fontSize: 13, marginBottom: 12, padding: 10, background: "#f9fafb", borderRadius: 8, lineHeight: 1.7 }}>
              <div>เลขที่จ่าย: <b style={{ fontFamily: "monospace" }}>{modal.row.payment_no}</b> · {fmtDate(modal.row.payment_date)}</div>
              <div>ผู้รับเงิน: <b>{modal.row.pay_to || "-"}</b></div>
              <div>ยอดเงินโอน: <b style={{ color: "#7c3aed" }}>{fmt(modal.row.transfer)} บาท</b></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={mlbl}>วันที่โอน (ตั้งต้น = วันที่ใบจ่าย)</label>
              <input type="date" value={modal.transfer_date} onChange={e => setModal(m => ({ ...m, transfer_date: e.target.value }))} style={minp} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={mlbl}>บัญชีที่ใช้โอน *</label>
              <select value={modal.bank_account_id} onChange={e => setModal(m => ({ ...m, bank_account_id: e.target.value }))} style={minp}>
                <option value="">— เลือกบัญชี —</option>
                {banks.map(b => (
                  <option key={b.account_id || b.id} value={b.account_id || b.id}>
                    {[b.bank_name, b.account_no, b.account_name].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={mlbl}>หมายเหตุ</label>
              <input value={modal.note} onChange={e => setModal(m => ({ ...m, note: e.target.value }))} placeholder="(ไม่บังคับ)" style={minp} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} disabled={saving}
                style={{ padding: "8px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
                ปิด
              </button>
              <button onClick={doSave} disabled={saving}
                style={{ padding: "8px 18px", background: saving ? "#9ca3af" : "#0f766e", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const mlbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const minp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };

function KPI({ label, value, unit, color }) {
  return (
    <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
