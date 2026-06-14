import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้า "บันทึกโอนรถจักรยานยนต์ ระหว่างสาขา" — เมนู Sales
// ----------------------------------------------------------------------------
// แท็บ:
//  1) โอนออก — เลือกสาขาต้นทาง → สาขาปลายทาง → ระบบโหลดสต๊อกคงเหลือของต้นทาง
//             → ติ๊กได้หลายคัน → บันทึกโอน (status=sent)
//  2) รับโอน — เลือกสาขา(ตัวเอง) → เห็นรายการที่โอนมายังไม่รับ (sent) → ยืนยันรับ (received)
//  3) ประวัติ — รายการโอนทั้งหมด + ยกเลิก
// "สาขาปัจจุบัน" ของรถ = ปลายทางของการโอนล่าสุดที่ received แล้ว, ถ้าไม่มี = สาขากลางตามยี่ห้อ
//   (YAMAHA→SCY01, HONDA→SCY06) · รถที่ sent ค้าง (ยังไม่รับ) ถือว่า "กำลังโอน" ไม่อยู่สาขาใด
// backend: moto-transfer-api (save_transfer/list_transfers/receive_transfer/cancel_transfer)
//          + stock-turnover-api stock_on_hand (สต๊อกคงเหลือรถใหม่)
// ============================================================================
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const TRANSFER_API = `${BASE}/moto-transfer-api`;
const STOCK_API = `${BASE}/stock-turnover-api`;

const BRANCHES = [
  { code: "SCY01", label: "SCY01 สำนักงานใหญ่ (สิงห์ชัย)", brand: "YAMAHA" },
  { code: "SCY04", label: "SCY04 สีขวา (สิงห์ชัย)", brand: "YAMAHA" },
  { code: "SCY05", label: "SCY05 ป.เปา นครหลวง", brand: "HONDA" },
  { code: "SCY06", label: "SCY06 ป.เปา วังน้อย", brand: "HONDA" },
  { code: "SCY07", label: "SCY07 สิงห์ชัยตลาด (สิงห์ชัย)", brand: "YAMAHA" },
];
const brandOf = (code) => (["SCY05", "SCY06"].includes(code) ? "HONDA" : "YAMAHA");
const centralOf = (brand) => (brand === "YAMAHA" ? "SCY01" : "SCY06");
const brLabel = (c) => (BRANCHES.find((b) => b.code === c)?.label || c || "-");
const bikeKey = (r) => String(r.engine_no || r.chassis_no || "").toUpperCase();

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDateTH(iso) {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}` : "-";
}
async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}
const asArray = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);

export default function MotoTransferPage({ currentUser }) {
  const [tab, setTab] = useState("out"); // out | receive | history
  const [message, setMessage] = useState("");
  const who = currentUser?.username || currentUser?.name || "system";

  // ---------- โอนออก ----------
  const [fromBranch, setFromBranch] = useState("SCY06");
  const [toBranch, setToBranch] = useState("");
  const [transferDate, setTransferDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [stockRows, setStockRows] = useState([]);
  const [sel, setSel] = useState({}); // key -> bool
  const [loadingStock, setLoadingStock] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------- รับโอน ----------
  const [recvBranch, setRecvBranch] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [selRecv, setSelRecv] = useState({}); // id -> bool
  const [loadingRecv, setLoadingRecv] = useState(false);

  // ---------- ประวัติ ----------
  const [hist, setHist] = useState([]);
  const [hKeyword, setHKeyword] = useState("");
  const [hStatus, setHStatus] = useState("");
  const [loadingHist, setLoadingHist] = useState(false);

  // โหลดสต๊อกคงเหลือของสาขาต้นทาง = stock_on_hand(brand) กรองด้วย "สาขาปัจจุบัน" จาก transfers
  async function loadStock(from = fromBranch) {
    setLoadingStock(true); setMessage(""); setSel({});
    try {
      const brand = brandOf(from);
      const [stock, trans] = await Promise.all([
        postJson(STOCK_API, { action: "stock_on_hand", brand, as_of: todayISO(), new_only: true, deduct_sales: true }),
        postJson(TRANSFER_API, { action: "list_transfers", brand }).catch(() => []),
      ]);
      // latest non-cancelled transfer per bike
      const latest = new Map();
      asArray(trans).filter((t) => t.status !== "cancelled").forEach((t) => {
        const k = bikeKey(t);
        const cur = latest.get(k);
        const ord = (x) => `${String(x.transfer_date || "").slice(0, 10)}#${String(x.id).padStart(10, "0")}`;
        if (!cur || ord(t) > ord(cur)) latest.set(k, t);
      });
      const curBranch = (r) => {
        const t = latest.get(bikeKey(r));
        if (!t) return centralOf(brand);          // ยังไม่เคยโอน = อยู่สาขากลาง
        if (t.status === "received") return t.to_branch; // รับแล้ว = อยู่ปลายทาง
        return "__in_transit__";                  // sent ค้าง = กำลังโอน
      };
      const avail = asArray(stock).filter((r) => curBranch(r) === from);
      setStockRows(avail);
    } catch (e) {
      setMessage("❌ โหลดสต๊อกไม่สำเร็จ: " + (e.message || e));
      setStockRows([]);
    }
    setLoadingStock(false);
  }

  async function saveTransfer() {
    if (!fromBranch || !toBranch) { setMessage("❌ เลือกสาขาต้นทาง/ปลายทาง"); return; }
    if (fromBranch === toBranch) { setMessage("❌ สาขาต้นทางและปลายทางต้องต่างกัน"); return; }
    const items = stockRows.filter((r) => sel[bikeKey(r)]).map((r) => ({
      engine_no: r.engine_no || "", chassis_no: r.chassis_no || "",
      model: [r.model, r.model_type].filter(Boolean).join(" / "), color: r.color || "",
    }));
    if (!items.length) { setMessage("❌ ติ๊กเลือกรถอย่างน้อย 1 คัน"); return; }
    setSaving(true); setMessage("");
    try {
      const r = await postJson(TRANSFER_API, {
        action: "save_transfer", brand: brandOf(fromBranch),
        from_branch: fromBranch, to_branch: toBranch, transfer_date: transferDate, note, created_by: who, items,
      });
      const rows = asArray(r);
      const no = rows[0]?.transfer_no;
      if (!no) throw new Error("บันทึกไม่สำเร็จ");
      setMessage(`✅ บันทึกโอน ${rows.length} คัน — เลขที่ ${no} (${brLabel(fromBranch)} → ${brLabel(toBranch)})`);
      setSel({});
      loadStock(fromBranch);
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + (e.message || e));
    }
    setSaving(false);
  }

  async function loadIncoming(br = recvBranch) {
    if (!br) { setIncoming([]); return; }
    setLoadingRecv(true); setSelRecv({});
    try {
      const d = await postJson(TRANSFER_API, { action: "list_transfers", status: "sent", to_branch: br });
      setIncoming(asArray(d).filter((x) => x && x.id != null));
    } catch { setIncoming([]); }
    setLoadingRecv(false);
  }
  async function confirmReceive() {
    const ids = incoming.filter((r) => selRecv[r.id]).map((r) => r.id);
    if (!ids.length) { setMessage("❌ ติ๊กเลือกรายการที่จะรับ"); return; }
    try {
      await postJson(TRANSFER_API, { action: "receive_transfer", ids, received_by: who });
      setMessage(`✅ รับโอน ${ids.length} คัน เข้าสาขา ${recvBranch} แล้ว`);
      loadIncoming(recvBranch);
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  async function loadHist() {
    setLoadingHist(true);
    try {
      const d = await postJson(TRANSFER_API, { action: "list_transfers", keyword: hKeyword.trim(), status: hStatus });
      setHist(asArray(d).filter((x) => x && x.id != null));
    } catch { setHist([]); }
    setLoadingHist(false);
  }
  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกการโอน ${r.transfer_no} (เลขเครื่อง ${r.engine_no || r.chassis_no})?`)) return;
    try {
      await postJson(TRANSFER_API, { action: "cancel_transfer", ids: [r.id], cancelled_by: who });
      setMessage(`✅ ยกเลิกแล้ว`); loadHist();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  useEffect(() => { loadStock(fromBranch); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (tab === "history") loadHist(); /* eslint-disable-next-line */ }, [tab]);

  const selCount = Object.values(sel).filter(Boolean).length;
  const allSel = stockRows.length > 0 && stockRows.every((r) => sel[bikeKey(r)]);
  const selRecvCount = Object.values(selRecv).filter(Boolean).length;

  return (
    <div className="page-container">
      <div className="page-topbar"><h2 className="page-title">🔁 บันทึกโอนรถจักรยานยนต์ ระหว่างสาขา</h2></div>

      {message && <div style={{ padding: 10, marginBottom: 10, borderRadius: 6, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setTab("out")} style={tabBtn(tab === "out")}>📤 โอนออก</button>
        <button onClick={() => setTab("receive")} style={tabBtn(tab === "receive")}>📥 รับโอน</button>
        <button onClick={() => setTab("history")} style={tabBtn(tab === "history")}>📜 ประวัติ</button>
      </div>

      {/* ===================== โอนออก ===================== */}
      {tab === "out" && (
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 }}>
            <Field label="สาขาต้นทาง *">
              <select value={fromBranch} onChange={(e) => { setFromBranch(e.target.value); if (toBranch === e.target.value) setToBranch(""); loadStock(e.target.value); }} style={inp}>
                {BRANCHES.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
              </select>
            </Field>
            <Field label="สาขาปลายทาง *">
              <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} style={inp}>
                <option value="">-- เลือก --</option>
                {BRANCHES.filter((b) => b.code !== fromBranch).map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
              </select>
            </Field>
            <Field label="วันที่โอน">
              <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} style={inp} />
            </Field>
            <Field label="หมายเหตุ">
              <input value={note} onChange={(e) => setNote(e.target.value)} style={inp} placeholder="(ไม่บังคับ)" />
            </Field>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>สต๊อกคงเหลือ {brLabel(fromBranch)} <span style={{ color: "#6b7280", fontWeight: 400 }}>({stockRows.length} คัน · {brandOf(fromBranch)})</span></span>
            <button onClick={() => loadStock(fromBranch)} disabled={loadingStock} style={btnBlueSm}>{loadingStock ? "..." : "🔄 โหลดสต๊อก"}</button>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#047857", fontWeight: 600 }}>เลือก {selCount} คัน</span>
            <button onClick={saveTransfer} disabled={saving || selCount === 0 || !toBranch} style={{ ...btnGreen, opacity: (saving || selCount === 0 || !toBranch) ? 0.5 : 1 }}>
              {saving ? "..." : `💾 บันทึกโอน${toBranch ? " → " + toBranch : ""}`}
            </button>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={{ ...th, width: 36 }}><input type="checkbox" checked={allSel} onChange={(e) => { const v = e.target.checked; const m = {}; if (v) stockRows.forEach((r) => (m[bikeKey(r)] = true)); setSel(m); }} /></th>
                  <th style={{ ...th, textAlign: "left" }}>รุ่น/แบบ</th><th style={th}>type</th><th style={{ ...th, textAlign: "left" }}>สี</th>
                  <th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th><th style={{ ...th, textAlign: "left" }}>เลขถัง</th><th style={{ ...th, textAlign: "right" }}>รับเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {loadingStock && <tr><td colSpan={7} style={{ padding: 18, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!loadingStock && stockRows.length === 0 && <tr><td colSpan={7} style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}>ไม่มีสต๊อกคงเหลือที่สาขานี้</td></tr>}
                {stockRows.map((r) => {
                  const k = bikeKey(r);
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid #eef2f7", background: sel[k] ? "#ecfdf5" : "transparent", cursor: "pointer" }} onClick={() => setSel((s) => ({ ...s, [k]: !s[k] }))}>
                      <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={!!sel[k]} onChange={() => {}} /></td>
                      <td style={td}>{r.model || "-"}</td>
                      <td style={{ ...td, textAlign: "center" }}>{r.model_type || "-"}</td>
                      <td style={td}>{r.color || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtDateTH(r.received_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== รับโอน ===================== */}
      {tab === "receive" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
            <Field label="สาขาที่รับ (ปลายทาง) *">
              <select value={recvBranch} onChange={(e) => { setRecvBranch(e.target.value); loadIncoming(e.target.value); }} style={{ ...inp, minWidth: 220 }}>
                <option value="">-- เลือกสาขา --</option>
                {BRANCHES.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
              </select>
            </Field>
            <button onClick={() => loadIncoming(recvBranch)} disabled={loadingRecv || !recvBranch} style={btnBlueSm}>{loadingRecv ? "..." : "🔄 โหลด"}</button>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#047857", fontWeight: 600 }}>เลือก {selRecvCount} คัน</span>
            <button onClick={confirmReceive} disabled={selRecvCount === 0} style={{ ...btnGreen, opacity: selRecvCount === 0 ? 0.5 : 1 }}>📥 ยืนยันรับโอน</button>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={{ ...th, width: 36 }}><input type="checkbox" checked={incoming.length > 0 && incoming.every((r) => selRecv[r.id])} onChange={(e) => { const v = e.target.checked; const m = {}; if (v) incoming.forEach((r) => (m[r.id] = true)); setSelRecv(m); }} /></th>
                  <th style={th}>เลขที่โอน</th><th style={th}>วันที่</th><th style={th}>จากสาขา</th>
                  <th style={{ ...th, textAlign: "left" }}>รุ่น/แบบ</th><th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th><th style={th}>โดย</th>
                </tr>
              </thead>
              <tbody>
                {loadingRecv && <tr><td colSpan={7} style={{ padding: 18, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!loadingRecv && !recvBranch && <tr><td colSpan={7} style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}>เลือกสาขาที่รับก่อน</td></tr>}
                {!loadingRecv && recvBranch && incoming.length === 0 && <tr><td colSpan={7} style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการรอรับ</td></tr>}
                {incoming.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7", background: selRecv[r.id] ? "#ecfdf5" : "transparent", cursor: "pointer" }} onClick={() => setSelRecv((s) => ({ ...s, [r.id]: !s[r.id] }))}>
                    <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={!!selRecv[r.id]} onChange={() => {}} /></td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.transfer_no}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTH(r.transfer_date)}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.from_branch}</td>
                    <td style={td}>{r.model || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || r.chassis_no || "-"}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.created_by || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== ประวัติ ===================== */}
      {tab === "history" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input value={hKeyword} onChange={(e) => setHKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadHist()} placeholder="ค้นหา เลขเครื่อง/เลขถัง/รุ่น/เลขที่โอน" style={{ ...inp, maxWidth: 320 }} />
            <select value={hStatus} onChange={(e) => setHStatus(e.target.value)} style={{ ...inp, maxWidth: 160 }}>
              <option value="">ทุกสถานะ</option><option value="sent">รอรับ (sent)</option><option value="received">รับแล้ว</option><option value="cancelled">ยกเลิก</option>
            </select>
            <button onClick={loadHist} disabled={loadingHist} style={btnBlueSm}>{loadingHist ? "..." : "🔍 ค้นหา"}</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr><th style={th}>เลขที่โอน</th><th style={th}>วันที่</th><th style={th}>ยี่ห้อ</th><th style={{ ...th, textAlign: "left" }}>รุ่น/แบบ</th><th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th><th style={th}>จาก</th><th style={th}>ไป</th><th style={th}>สถานะ</th><th style={th}></th></tr>
              </thead>
              <tbody>
                {loadingHist && <tr><td colSpan={9} style={{ padding: 18, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!loadingHist && hist.length === 0 && <tr><td colSpan={9} style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                {hist.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "cancelled" ? 0.5 : 1 }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{r.transfer_no}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTH(r.transfer_date)}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.brand}</td>
                    <td style={td}>{r.model || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || r.chassis_no || "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.from_branch}</td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#047857" }}>{r.to_branch}</td>
                    <td style={{ ...td, textAlign: "center" }}><StatusBadge s={r.status} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{r.status !== "cancelled" && <button onClick={() => cancelRow(r)} style={btnRedSm}>ยกเลิก</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }) {
  const m = { sent: { l: "รอรับ", c: "#92400e", b: "#fef3c7" }, received: { l: "รับแล้ว", c: "#065f46", b: "#dcfce7" }, cancelled: { l: "ยกเลิก", c: "#dc2626", b: "#fee2e2" } };
  const o = m[s] || { l: s, c: "#374151", b: "#f3f4f6" };
  return <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: o.b, color: o.c }}>{o.l}</span>;
}
function Field({ label, children }) {
  return <div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>{children}</div>;
}
const card = { background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const tabBtn = (on) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: on ? "#072d6b" : "#e5e7eb", color: on ? "#fff" : "#374151" });
const btnBlueSm = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" };
const btnGreen = { padding: "9px 18px", background: "#2e9e4f", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" };
const btnRedSm = { padding: "4px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const th = { padding: "8px 10px", textAlign: "center", fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "7px 10px", verticalAlign: "top" };
