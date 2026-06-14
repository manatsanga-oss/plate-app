import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้า "บันทึกโอนรถจักรยานยนต์ ระหว่างสาขา" — เมนู Sales
// ----------------------------------------------------------------------------
// แท็บ:
//  1) โอนออก — ฟอร์มใบโอน: เลือกสาขาต้นทาง/ปลายทาง/วันที่ → กดปุ่ม "เลือกรถจักรยานยนต์"
//             เปิด popup ค้นหา (เลขเครื่อง/เลขถัง/รุ่น) จากสต๊อกคงเหลือของต้นทาง → ติ๊กหลายคัน
//             → เพิ่มลงรายการใบโอน → บันทึกใบโอน (status=sent)
//  2) รับโอน — เลือกสาขา → เห็นรายการ sent ที่ to_branch=สาขานั้น → ยืนยันรับ (received)
//  3) ประวัติ — รายการโอนทั้งหมด + ยกเลิก
// "สาขาปัจจุบัน" ของรถ = ปลายทางของโอนล่าสุดที่ received, ไม่งั้น=สาขากลางตามยี่ห้อ
//   (YAMAHA→SCY01, HONDA→SCY06); status=sent ค้าง=กำลังโอน
// backend: moto-transfer-api (save/list/receive/cancel) + stock-turnover-api stock_on_hand
// ============================================================================
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const TRANSFER_API = `${BASE}/moto-transfer-api`;
const STOCK_API = `${BASE}/stock-turnover-api`;

const BRANCHES = [
  { code: "SCY01", label: "SCY01 สำนักงานใหญ่ (สิงห์ชัย)" },
  { code: "SCY04", label: "SCY04 สีขวา (สิงห์ชัย)" },
  { code: "SCY05", label: "SCY05 ป.เปา นครหลวง" },
  { code: "SCY06", label: "SCY06 ป.เปา วังน้อย" },
  { code: "SCY07", label: "SCY07 สิงห์ชัยตลาด (สิงห์ชัย)" },
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
const bikeName = (r) => [r.model, r.model_type, r.color].filter(Boolean).join(" · ");

export default function MotoTransferPage({ currentUser, onNavigate }) {
  const [tab, setTab] = useState("out");
  const [message, setMessage] = useState("");
  const who = currentUser?.username || currentUser?.name || "system";
  // สาขาต้นทาง default = สาขาของ user ที่ login (ดึง SCYxx จาก branch_code/branch) ถ้าไม่เข้าพวกใช้ SCY06
  const userBranch = (() => {
    const m = String(currentUser?.branch_code || currentUser?.branch || "").match(/SCY\d+/i);
    const code = m ? m[0].toUpperCase() : "";
    return BRANCHES.some((b) => b.code === code) ? code : "SCY06";
  })();

  // ---------- โอนออก (ฟอร์มใบโอน) ----------
  const [fromBranch, setFromBranch] = useState(userBranch);
  const [toBranch, setToBranch] = useState("");
  const [transferDate, setTransferDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);        // รถที่เลือกลงใบโอน
  const [stockRows, setStockRows] = useState([]); // สต๊อกคงเหลือของสาขาต้นทาง
  const [loadingStock, setLoadingStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastTransfer, setLastTransfer] = useState(null); // สรุปใบโอนที่เพิ่งบันทึก (โชว์ปุ่มจองคนขับ)
  // popup เลือกรถ
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSel, setPickerSel] = useState({});
  const [pickerSearch, setPickerSearch] = useState("");

  // ---------- รับโอน ----------
  const [recvBranch, setRecvBranch] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [selRecv, setSelRecv] = useState({});
  const [loadingRecv, setLoadingRecv] = useState(false);

  // ---------- ประวัติ ----------
  const [hist, setHist] = useState([]);
  const [hKeyword, setHKeyword] = useState("");
  const [hStatus, setHStatus] = useState("");
  const [loadingHist, setLoadingHist] = useState(false);

  async function loadStock(from = fromBranch) {
    setLoadingStock(true); setMessage("");
    try {
      const brand = brandOf(from);
      const [stock, trans] = await Promise.all([
        postJson(STOCK_API, { action: "stock_on_hand", brand, as_of: todayISO(), new_only: true, deduct_sales: true }),
        postJson(TRANSFER_API, { action: "list_transfers", brand }).catch(() => []),
      ]);
      const latest = new Map();
      asArray(trans).filter((t) => t.status !== "cancelled").forEach((t) => {
        const k = bikeKey(t); const cur = latest.get(k);
        const ord = (x) => `${String(x.transfer_date || "").slice(0, 10)}#${String(x.id).padStart(10, "0")}`;
        if (!cur || ord(t) > ord(cur)) latest.set(k, t);
      });
      const curBranch = (r) => {
        const t = latest.get(bikeKey(r));
        if (!t) return centralOf(brand);
        if (t.status === "received") return t.to_branch;
        return "__in_transit__";
      };
      setStockRows(asArray(stock).filter((r) => curBranch(r) === from));
    } catch (e) {
      setMessage("❌ โหลดสต๊อกไม่สำเร็จ: " + (e.message || e));
      setStockRows([]);
    }
    setLoadingStock(false);
  }

  // เปลี่ยนสาขาต้นทาง → ล้างรายการที่เลือก + โหลดสต๊อกใหม่
  function changeFrom(code) {
    setFromBranch(code);
    if (toBranch === code) setToBranch("");
    setItems([]); setLastTransfer(null);
    loadStock(code);
  }
  function openPicker() {
    if (!fromBranch) { setMessage("❌ เลือกสาขาต้นทางก่อน"); return; }
    setPickerSel({}); setPickerSearch(""); setShowPicker(true);
  }
  function addPicked() {
    const have = new Set(items.map(bikeKey));
    const add = stockRows.filter((r) => pickerSel[bikeKey(r)] && !have.has(bikeKey(r)))
      .map((r) => ({ engine_no: r.engine_no || "", chassis_no: r.chassis_no || "", model: r.model || "", model_type: r.model_type || "", color: r.color || "", received_date: r.received_date }));
    setItems((cur) => [...cur, ...add]);
    setLastTransfer(null);
    setShowPicker(false);
  }
  const removeItem = (k) => setItems((cur) => cur.filter((r) => bikeKey(r) !== k));

  async function saveTransfer() {
    if (!fromBranch || !toBranch) { setMessage("❌ เลือกสาขาต้นทาง/ปลายทาง"); return; }
    if (fromBranch === toBranch) { setMessage("❌ สาขาต้นทางและปลายทางต้องต่างกัน"); return; }
    if (!items.length) { setMessage("❌ เลือกรถอย่างน้อย 1 คัน"); return; }
    setSaving(true); setMessage("");
    try {
      const r = await postJson(TRANSFER_API, {
        action: "save_transfer", brand: brandOf(fromBranch),
        from_branch: fromBranch, to_branch: toBranch, transfer_date: transferDate, note, created_by: who,
        items: items.map((r) => ({ engine_no: r.engine_no, chassis_no: r.chassis_no, model: [r.model, r.model_type].filter(Boolean).join(" / "), color: r.color })),
      });
      const rows = asArray(r); const no = rows[0]?.transfer_no;
      if (!no) throw new Error("บันทึกไม่สำเร็จ");
      setMessage(`✅ บันทึกใบโอน ${rows.length} คัน — เลขที่ ${no} (${fromBranch} → ${toBranch})`);
      setLastTransfer({ no, count: rows.length, from: fromBranch, to: toBranch });
      setItems([]); setNote("");
      loadStock(fromBranch);
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + (e.message || e));
    }
    setSaving(false);
  }

  async function loadIncoming(br = recvBranch) {
    if (!br) { setIncoming([]); return; }
    setLoadingRecv(true); setSelRecv({});
    try { setIncoming(asArray(await postJson(TRANSFER_API, { action: "list_transfers", status: "sent", to_branch: br })).filter((x) => x && x.id != null)); }
    catch { setIncoming([]); }
    setLoadingRecv(false);
  }
  async function confirmReceive() {
    const ids = incoming.filter((r) => selRecv[r.id]).map((r) => r.id);
    if (!ids.length) { setMessage("❌ ติ๊กเลือกรายการที่จะรับ"); return; }
    try { await postJson(TRANSFER_API, { action: "receive_transfer", ids, received_by: who }); setMessage(`✅ รับโอน ${ids.length} คัน เข้าสาขา ${recvBranch} แล้ว`); loadIncoming(recvBranch); }
    catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  async function loadHist() {
    setLoadingHist(true);
    try { setHist(asArray(await postJson(TRANSFER_API, { action: "list_transfers", keyword: hKeyword.trim(), status: hStatus })).filter((x) => x && x.id != null)); }
    catch { setHist([]); }
    setLoadingHist(false);
  }
  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกการโอน ${r.transfer_no} (เลขเครื่อง ${r.engine_no || r.chassis_no})?`)) return;
    try { await postJson(TRANSFER_API, { action: "cancel_transfer", ids: [r.id], cancelled_by: who }); setMessage("✅ ยกเลิกแล้ว"); loadHist(); }
    catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  useEffect(() => { loadStock(fromBranch); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (tab === "history") loadHist(); /* eslint-disable-next-line */ }, [tab]);

  // สต๊อกที่ยังเลือกได้ใน popup (ตัดที่อยู่ในใบโอนแล้ว + กรองคำค้น)
  const have = useMemo(() => new Set(items.map(bikeKey)), [items]);
  const pkw = pickerSearch.trim().toLowerCase();
  const pickable = useMemo(() => stockRows.filter((r) => !have.has(bikeKey(r)))
    .filter((r) => !pkw || [r.engine_no, r.chassis_no, r.model, r.color].some((v) => String(v || "").toLowerCase().includes(pkw))), [stockRows, have, pkw]);
  const pickerCount = Object.values(pickerSel).filter(Boolean).length;
  const allPick = pickable.length > 0 && pickable.every((r) => pickerSel[bikeKey(r)]);
  const selRecvCount = Object.values(selRecv).filter(Boolean).length;

  return (
    <div className="page-container">
      <div className="page-topbar"><h2 className="page-title">🔁 บันทึกใบโอนรถจักรยานยนต์ ระหว่างสาขา</h2></div>

      {message && <div style={{ padding: 10, marginBottom: 10, borderRadius: 6, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setTab("out")} style={tabBtn(tab === "out")}>📤 โอนออก</button>
        <button onClick={() => setTab("receive")} style={tabBtn(tab === "receive")}>📥 รับโอน</button>
        <button onClick={() => setTab("history")} style={tabBtn(tab === "history")}>📜 ประวัติ</button>
      </div>

      {/* ===================== โอนออก ===================== */}
      {tab === "out" && (
        <div style={card}>
          {lastTransfer && (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ color: "#065f46", fontWeight: 600 }}>✅ บันทึกใบโอน {lastTransfer.no} แล้ว ({lastTransfer.count} คัน · {lastTransfer.from} → {lastTransfer.to})</span>
              <button onClick={() => onNavigate && onNavigate("booking")} style={{ ...btnBlue, background: "#7c3aed" }}>🚗 บันทึกจองคนขับรถ</button>
              <button onClick={() => setLastTransfer(null)} style={{ ...btnBlueSm, background: "#8aa0a6" }}>ปิด</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="สาขาต้นทาง *">
              <select value={fromBranch} onChange={(e) => changeFrom(e.target.value)} style={inp}>
                {BRANCHES.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
              </select>
            </Field>
            <Field label="สาขาปลายทาง (รับโอน) *">
              <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} style={inp}>
                <option value="">-- เลือกสาขารับโอน --</option>
                {BRANCHES.filter((b) => b.code !== fromBranch).map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
              </select>
            </Field>
            <Field label="วันที่โอน"><input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} style={inp} /></Field>
            <Field label="พนักงานผู้โอน"><input value={who} readOnly style={{ ...inp, background: "#f3f4f6" }} /></Field>
          </div>
          <Field label="หมายเหตุ"><input value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inp, marginTop: 0 }} placeholder="(ไม่บังคับ)" /></Field>

          {/* ปุ่มเลือกรถ + บันทึก */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 8px" }}>
            <button onClick={openPicker} disabled={loadingStock} style={btnBlue}>
              {loadingStock ? "กำลังโหลดสต๊อก..." : "🏍️ เลือกรถจักรยานยนต์"}
            </button>
            <span style={{ fontSize: 12, color: "#6b7280" }}>สต๊อกคงเหลือ {fromBranch}: {stockRows.length} คัน</span>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#047857", fontWeight: 600 }}>ในใบโอน {items.length} คัน</span>
            <button onClick={saveTransfer} disabled={saving || items.length === 0 || !toBranch}
              style={{ ...btnGreen, opacity: (saving || items.length === 0 || !toBranch) ? 0.5 : 1 }}>
              {saving ? "..." : `💾 บันทึกใบโอน${toBranch ? " → " + toBranch : ""}`}
            </button>
          </div>

          {/* รายการในใบโอน */}
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr><th style={{ ...th, width: 44 }}>No</th><th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th><th style={{ ...th, textAlign: "left" }}>ชื่อสินค้า (รุ่น/แบบ/สี)</th><th style={{ ...th, textAlign: "left" }}>เลขถัง</th><th style={th}>รับเมื่อ</th><th style={{ ...th, width: 70 }}></th></tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}>ยังไม่ได้เลือกรถ — กด "เลือกรถจักรยานยนต์"</td></tr>}
                {items.map((r, i) => (
                  <tr key={bikeKey(r)} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.engine_no || "-"}</td>
                    <td style={td}>{bikeName(r) || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{fmtDateTH(r.received_date)}</td>
                    <td style={{ ...td, textAlign: "center" }}><button onClick={() => removeItem(bikeKey(r))} style={btnRedSm}>✕ ลบ</button></td>
                  </tr>
                ))}
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
                <tr><th style={{ ...th, width: 36 }}><input type="checkbox" checked={incoming.length > 0 && incoming.every((r) => selRecv[r.id])} onChange={(e) => { const v = e.target.checked; const m = {}; if (v) incoming.forEach((r) => (m[r.id] = true)); setSelRecv(m); }} /></th><th style={th}>เลขที่โอน</th><th style={th}>วันที่</th><th style={th}>จากสาขา</th><th style={{ ...th, textAlign: "left" }}>รุ่น/แบบ</th><th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th><th style={th}>โดย</th></tr>
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

      {/* ===================== Popup เลือกรถจักรยานยนต์ ===================== */}
      {showPicker && (
        <div onClick={() => setShowPicker(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(900px, 97vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b" }}>🏍️ ค้นหารถจักรยานยนต์ — สต๊อก {fromBranch} ({brandOf(fromBranch)})</div>
              <button onClick={() => setShowPicker(false)} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0 10px" }}>
              <input autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="🔍 พิมพ์เลขเครื่อง / เลขถัง / รุ่น (บางส่วน)" style={{ ...inp, flex: 1 }} />
              <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{pickable.length} คัน</span>
            </div>
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8, maxHeight: "55vh", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#072d6b", color: "#fff", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={{ ...th, width: 36 }}><input type="checkbox" checked={allPick} onChange={(e) => { const v = e.target.checked; setPickerSel((s) => { const m = { ...s }; pickable.forEach((r) => { m[bikeKey(r)] = v; }); return m; }); }} /></th>
                    <th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th><th style={{ ...th, textAlign: "left" }}>เลขถัง</th><th style={{ ...th, textAlign: "left" }}>รุ่น/แบบ</th><th style={th}>type</th><th style={{ ...th, textAlign: "left" }}>สี</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStock && <tr><td colSpan={6} style={{ padding: 16, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                  {!loadingStock && pickable.length === 0 && <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#9ca3af" }}>{stockRows.length === 0 ? "ไม่มีสต๊อกคงเหลือที่สาขานี้" : "ไม่พบรถตามคำค้น / เลือกครบแล้ว"}</td></tr>}
                  {pickable.map((r) => {
                    const k = bikeKey(r);
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid #eef2f7", background: pickerSel[k] ? "#ecfdf5" : "transparent", cursor: "pointer" }} onClick={() => setPickerSel((s) => ({ ...s, [k]: !s[k] }))}>
                        <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={!!pickerSel[k]} onChange={() => {}} /></td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                        <td style={td}>{r.model || "-"}</td>
                        <td style={{ ...td, textAlign: "center" }}>{r.model_type || "-"}</td>
                        <td style={td}>{r.color || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowPicker(false)} style={{ ...btnBlueSm, background: "#8aa0a6" }}>ปิด</button>
              <button onClick={addPicked} disabled={pickerCount === 0} style={{ ...btnGreen, opacity: pickerCount === 0 ? 0.5 : 1 }}>➕ เพิ่มที่เลือก ({pickerCount})</button>
            </div>
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
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const card = { background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box", marginTop: 4 };
const tabBtn = (on) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: on ? "#072d6b" : "#e5e7eb", color: on ? "#fff" : "#374151" });
const btnBlue = { padding: "9px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" };
const btnBlueSm = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" };
const btnGreen = { padding: "9px 18px", background: "#2e9e4f", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" };
const btnRedSm = { padding: "4px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const th = { padding: "8px 10px", textAlign: "center", fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "7px 10px", verticalAlign: "top" };
