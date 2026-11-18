import React, { useEffect, useMemo, useState } from "react";

// เมนู Spare Inventory → "รายการอะไหล่ทดแทน" (user 2026-11-18) — 2 แท็บ
//   แท็บ 1 รายการอะไหล่ทดแทน: ตาราง part_substitutes เดิม (คู่รหัสที่สั่ง ↔ รหัสที่บริษัทส่งมาแทน — บันทึกจากหน้ารายการสั่งอะไหล่รายวัน/ระบบสั่งซื้อ)
//     เปิดดู/ค้น/เพิ่ม/แก้ได้ที่นี่ + สต๊อกของทั้งสองรหัส (ตารางเดียวกับที่หน้าสั่งซื้อ/สต๊อกหมุนเร็วใช้เตือนรหัสทดแทน)
//   แท็บ 2 รายการอะไหล่ที่ยกเลิกการผลิต: รวมรหัสที่ติ๊ก "ยกเลิกผลิต" ในรายงานอะไหล่หมุนเร็ว (fast_moving_parts.is_discontinued) กับรหัสนอกหมุนเร็วที่เพิ่มเอง (part_discontinued)
//     + รหัสทดแทน + สต๊อกคงเหลือ (ของที่ยังขายได้จนหมด)
// n8n part-substitute-api (Part_Substitute_Workflow.json) — ทำ list + สต๊อกใน query เดียว ไม่ยิงทีละรหัส
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-substitute-api";

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return t.trim() ? JSON.parse(t) : null; } catch { return null; }
}
const parseList = (r) => { try { const l = JSON.parse(r?.listjson || "[]"); return Array.isArray(l) ? l : []; } catch { return []; } };
const asArr = (v) => Array.isArray(v) ? v : (() => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } })();
const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return y && m && d ? `${d}/${m}/${String(Number(y) + 543).slice(-2)}` : iso; };
// created_at ของ part_substitutes ในฐานจริงเป็น timestamp ไม่มีโซน (เก็บ UTC) → เติม Z แล้วแสดงเป็นวันที่เวลาไทย (ไม่ใช้ created_date จาก SQL ที่เพี้ยนไป 1 วันช่วงเช้า)
const fmtTs = (v) => { const t = String(v || ""); if (!t) return ""; const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(t) ? t : t + "Z"); if (isNaN(d)) return ""; return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear() + 543).slice(-2)}`; };
const num = (v) => { const n = Number(v); return isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : "-"; };
const strip = (s) => String(s || "").toUpperCase().replace(/[-\s]/g, "");
const sumQty = (stock) => (stock || []).reduce((s, x) => s + Number(x.qty || 0), 0);

const th = { padding: "8px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#fff", background: "#072d6b", whiteSpace: "nowrap", position: "sticky", top: 0 };
const td = { padding: "6px 8px", fontSize: 13, verticalAlign: "top", borderBottom: "1px solid #e5e7eb" };
const card = { background: "#fff", borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.08)" };
const inp = { padding: "7px 10px", fontSize: 14, borderRadius: 8, border: "1px solid #cbd5e1" };
const btn = (bg) => ({ padding: "7px 14px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 });
const mini = (bg) => ({ padding: "3px 8px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, marginRight: 4 });

function StockCell({ stock }) {
  const list = stock || [];
  if (!list.length) return <span style={{ color: "#9ca3af" }}>ไม่มี</span>;
  return list.map((s, j) => <div key={j} style={{ whiteSpace: "nowrap" }}><b style={{ color: "#15803d" }}>{num(s.qty)}</b> {s.source}</div>);
}

export default function PartSubstitutePage({ currentUser }) {
  const me = currentUser?.name || currentUser?.username || "";
  const isAdmin = currentUser?.role === "admin";
  const [tab, setTab] = useState("subs"); // subs | disc
  const [subs, setSubs] = useState([]);
  const [disc, setDisc] = useState([]);
  const [loaded, setLoaded] = useState({ subs: false, disc: false });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  // แท็บ 1
  const EMPTY_SUB = { id: 0, original_code: "", original_name: "", substitute_code: "", substitute_name: "" };
  const [subForm, setSubForm] = useState(EMPTY_SUB);
  const [onlySubStock, setOnlySubStock] = useState(false);
  // แท็บ 2
  const EMPTY_DISC = { editing: false, brand: "HONDA", part_code: "", part_name: "", announced_date: "", note: "" };
  const [discForm, setDiscForm] = useState(EMPTY_DISC);
  const [brand, setBrand] = useState("ALL");
  const [onlyStock, setOnlyStock] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadSubs() {
    setLoading(true); setMsg("");
    try {
      const r = await post({ action: "list_substitutes" });
      if (!r || r.error || r.message) { setMsg("❌ โหลดรายการอะไหล่ทดแทนไม่สำเร็จ" + (r?.error || r?.message ? `: ${r.error || r.message}` : "")); setSubs([]); }
      else setSubs(parseList(r).map((x) => ({ ...x, stock_original: asArr(x.stock_original), stock_substitute: asArr(x.stock_substitute) })));
      setLoaded((l) => ({ ...l, subs: true }));
    } catch (e) { setMsg("❌ " + String(e?.message || e)); }
    finally { setLoading(false); }
  }
  async function loadDisc() {
    setLoading(true); setMsg("");
    try {
      const r = await post({ action: "list_discontinued" });
      if (!r || r.error || r.message) { setMsg("❌ โหลดรายการอะไหล่ที่ยกเลิกการผลิตไม่สำเร็จ" + (r?.error || r?.message ? `: ${r.error || r.message}` : "")); setDisc([]); }
      else setDisc(parseList(r).map((x) => ({ ...x, stock: asArr(x.stock), replacements: asArr(x.replacements).map((p) => ({ ...p, stock: asArr(p.stock) })) })));
      setLoaded((l) => ({ ...l, disc: true }));
    } catch (e) { setMsg("❌ " + String(e?.message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (tab === "subs" && !loaded.subs) loadSubs(); if (tab === "disc" && !loaded.disc) loadDisc(); }, [tab]); // eslint-disable-line

  // ---------- แท็บ 1: อะไหล่ทดแทน ----------
  async function saveSub() {
    if (strip(subForm.original_code).length < 5 || strip(subForm.substitute_code).length < 5) { setMsg("❌ กรอกรหัสเดิมและรหัสทดแทนให้ครบ"); return; }
    setSaving(true); setMsg("");
    try {
      const r = await post({ action: "save_substitute", id: subForm.id || undefined, original_code: subForm.original_code, substitute_code: subForm.substitute_code, original_name: subForm.original_name, substitute_name: subForm.substitute_name, user: me });
      if (!r || r.error || r.message || !Number(r.saved)) { setMsg("❌ " + (r?.error || r?.message || "บันทึกไม่สำเร็จ")); return; }
      setMsg(`✅ ${subForm.id ? "แก้ไข" : "เพิ่ม"}คู่อะไหล่ทดแทนแล้ว: ${subForm.original_code.toUpperCase()} → ${subForm.substitute_code.toUpperCase()}`);
      setSubForm(EMPTY_SUB);
      await loadSubs();
    } finally { setSaving(false); }
  }
  async function deleteSub(r) {
    if (!window.confirm(`ลบคู่อะไหล่ทดแทน ${r.original_code} → ${r.substitute_code} ?\n(หน้าสั่งซื้อ/สต๊อกหมุนเร็วจะไม่เตือนรหัสคู่นี้อีก)`)) return;
    const res = await post({ action: "delete_substitute", id: r.id });
    if (!res || res.error || res.message || !Number(res.deleted)) { setMsg("❌ ลบไม่สำเร็จ" + (res?.error || res?.message ? `: ${res.error || res.message}` : "")); return; }
    setMsg(`✅ ลบคู่ ${r.original_code} → ${r.substitute_code} แล้ว`);
    setSubs((rs) => rs.filter((x) => x.id !== r.id));
  }
  const subsVisible = useMemo(() => {
    const k = strip(q); const t = q.trim().toLowerCase();
    return subs.filter((r) => {
      if (onlySubStock && sumQty(r.stock_original) + sumQty(r.stock_substitute) <= 0) return false;
      if (!t) return true;
      return (k && (strip(r.original_code).includes(k) || strip(r.substitute_code).includes(k))) || String(r.original_name || "").toLowerCase().includes(t) || String(r.substitute_name || "").toLowerCase().includes(t);
    });
  }, [subs, q, onlySubStock]);

  // ---------- แท็บ 2: ยกเลิกการผลิต ----------
  async function saveDisc() {
    if (strip(discForm.part_code).length < 5) { setMsg("❌ กรอกรหัสอะไหล่"); return; }
    setSaving(true); setMsg("");
    try {
      const r = await post({ action: "save_discontinued", brand: discForm.brand, part_code: discForm.part_code, part_name: discForm.part_name, note: discForm.note, announced_date: discForm.announced_date, user: me });
      if (!r || r.error || r.message || !r.id) { setMsg("❌ " + (r?.error || r?.message || "บันทึกไม่สำเร็จ")); return; }
      setMsg(`✅ บันทึก ${discForm.part_code.toUpperCase()} เป็นอะไหล่ยกเลิกการผลิตแล้ว${Number(r.fast_flagged) ? " (ติ๊กยกเลิกผลิตในรายงานอะไหล่หมุนเร็วให้ด้วย)" : ""}`);
      setDiscForm(EMPTY_DISC);
      await loadDisc();
    } finally { setSaving(false); }
  }
  async function deleteDisc(r) {
    if (!window.confirm(`เอา ${r.part_code} ออกจากรายการอะไหล่ที่ยกเลิกการผลิต ?${r.in_fast ? "\n(จะเอาเครื่องหมาย \"ยกเลิกผลิต\" ในรายงานอะไหล่หมุนเร็วออกด้วย)" : ""}`)) return;
    const res = await post({ action: "delete_discontinued", part_code: r.part_code });
    if (!res || res.error || res.message || !(Number(res.deleted) + Number(res.fast_unflagged))) { setMsg("❌ เอาออกไม่สำเร็จ" + (res?.error || res?.message ? `: ${res.error || res.message}` : "")); return; }
    setMsg(`✅ เอา ${r.part_code} ออกจากรายการแล้ว`);
    setDisc((rs) => rs.filter((x) => x.part_key !== r.part_key));
  }
  const discVisible = useMemo(() => {
    const k = strip(q); const t = q.trim().toLowerCase();
    return disc.filter((r) => {
      if (brand !== "ALL" && String(r.brand || "").toUpperCase() !== brand) return false;
      if (onlyStock && sumQty(r.stock) <= 0) return false;
      if (!t) return true;
      return (k && (strip(r.part_code).includes(k) || (r.replacements || []).some((p) => strip(p.code).includes(k)))) || String(r.part_name || "").toLowerCase().includes(t) || String(r.note || "").toLowerCase().includes(t);
    });
  }, [disc, q, brand, onlyStock]);
  const discStats = useMemo(() => ({ total: disc.length, withStock: disc.filter((r) => sumQty(r.stock) > 0).length, withRepl: disc.filter((r) => (r.replacements || []).length > 0).length }), [disc]);

  const tabBtn = (key, label, count) => (
    <button onClick={() => { setTab(key); setQ(""); setMsg(""); }} style={{ padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", borderBottom: tab === key ? "3px solid #072d6b" : "3px solid transparent", background: "transparent", color: tab === key ? "#072d6b" : "#6b7280" }}>
      {label}{count != null ? ` (${count})` : ""}
    </button>
  );

  return (
    <div style={{ padding: 16, maxWidth: 1500 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>🔁 รายการอะไหล่ทดแทน</h2>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
        คู่รหัสอะไหล่ที่ใช้แทนกันได้ (รหัสที่สั่ง → รหัสที่บริษัทส่งมาแทน) และรหัสที่ผู้ผลิตยกเลิกการผลิตแล้ว — ข้อมูลชุดเดียวกับที่หน้าสั่งซื้ออะไหล่และสต๊อกหมุนเร็วใช้เตือน · สต๊อกอ่านจากไฟล์สินค้าคงเหลือรอบล่าสุด
      </div>
      <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: 12 }}>
        {tabBtn("subs", "รายการอะไหล่ทดแทน", loaded.subs ? subs.length : null)}
        {tabBtn("disc", "รายการอะไหล่ที่ยกเลิกการผลิต", loaded.disc ? disc.length : null)}
      </div>

      {msg && <div style={{ marginBottom: 10, fontSize: 13, color: msg.startsWith("❌") ? "#dc2626" : "#15803d" }}>{msg}</div>}

      {tab === "subs" && (
        <>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#072d6b", marginBottom: 6 }}>{subForm.id ? `✏️ แก้ไขคู่อะไหล่ทดแทน #${subForm.id}` : "➕ เพิ่มคู่อะไหล่ทดแทน"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={subForm.original_code} onChange={(e) => setSubForm({ ...subForm, original_code: e.target.value })} placeholder="รหัสเดิม (ที่สั่ง)" style={{ ...inp, width: 170, fontFamily: "monospace" }} />
              <input value={subForm.original_name} onChange={(e) => setSubForm({ ...subForm, original_name: e.target.value })} placeholder="ชื่ออะไหล่เดิม" style={{ ...inp, width: 200 }} />
              <span style={{ fontSize: 18, color: "#6b7280" }}>→</span>
              <input value={subForm.substitute_code} onChange={(e) => setSubForm({ ...subForm, substitute_code: e.target.value })} placeholder="รหัสทดแทน (ใช้แทน)" style={{ ...inp, width: 170, fontFamily: "monospace" }} />
              <input value={subForm.substitute_name} onChange={(e) => setSubForm({ ...subForm, substitute_name: e.target.value })} placeholder="ชื่ออะไหล่ทดแทน" style={{ ...inp, width: 200 }}
                onKeyDown={(e) => { if (e.key === "Enter") saveSub(); }} />
              <button onClick={saveSub} disabled={saving} style={btn("#15803d")}>{saving ? "กำลังบันทึก…" : "💾 บันทึก"}</button>
              {subForm.id ? <button onClick={() => setSubForm(EMPTY_SUB)} style={btn("#6b7280")}>ยกเลิก</button> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นรหัส / ชื่ออะไหล่" style={{ ...inp, width: 280 }} />
            <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={onlySubStock} onChange={(e) => setOnlySubStock(e.target.checked)} /> เฉพาะคู่ที่มีสต๊อก</label>
            <button onClick={loadSubs} disabled={loading} style={btn("#072d6b")}>{loading ? "กำลังโหลด…" : "Refresh"}</button>
            <span style={{ fontSize: 12, color: "#6b7280" }}>แสดง {subsVisible.length} จาก {subs.length} คู่</span>
          </div>

          <div style={{ ...card, padding: 0, overflow: "auto", maxHeight: "68vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>รหัสเดิม (ที่สั่ง)</th><th style={th}>ชื่อ</th><th style={th}>สต๊อกรหัสเดิม</th>
                  <th style={th}></th>
                  <th style={th}>รหัสทดแทน</th><th style={th}>ชื่อ</th><th style={th}>สต๊อกรหัสทดแทน</th>
                  <th style={th}>บันทึกโดย</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {subsVisible.length === 0 && !loading && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#6b7280", padding: 24 }}>{subs.length ? "ไม่พบรายการที่ค้น" : "ยังไม่มีคู่อะไหล่ทดแทน"}</td></tr>}
                {subsVisible.map((r, i) => (
                  <tr key={r.id} style={{ background: subForm.id === r.id ? "#fef9c3" : (i % 2 ? "#fafafa" : "#fff") }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {r.original_code}
                      {r.original_discontinued && <div style={{ fontSize: 10, color: "#b91c1c", fontFamily: "inherit", fontWeight: 700 }}>🚫 ยกเลิกการผลิต</div>}
                    </td>
                    <td style={td}>{r.original_name || "-"}</td>
                    <td style={td}><StockCell stock={r.stock_original} /></td>
                    <td style={{ ...td, color: "#6b7280", fontSize: 16 }}>→</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap", color: "#1d4ed8" }}>{r.substitute_code}</td>
                    <td style={td}>{r.substitute_name || "-"}</td>
                    <td style={td}><StockCell stock={r.stock_substitute} /></td>
                    <td style={{ ...td, fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{r.approved_by || "-"}<div>{fmtTs(r.created_at) || fmtDate(r.created_date)}{r.order_id ? ` · ใบสั่ง #${r.order_id}` : ""}</div></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => { setSubForm({ id: r.id, original_code: r.original_code || "", original_name: r.original_name || "", substitute_code: r.substitute_code || "", substitute_name: r.substitute_name || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={mini("#2563eb")}>แก้ไข</button>
                      {isAdmin && <button onClick={() => deleteSub(r)} style={mini("#dc2626")}>ลบ</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
            คู่ใหม่จะถูกเพิ่มอัตโนมัติเมื่อกด "บันทึกอะไหล่ทดแทน" ในหน้ารายการสั่งอะไหล่รายวัน · แก้ไขได้ทุกคน ลบได้เฉพาะ admin · การเตือนในหน้าสั่งซื้อจะเห็นคู่ใหม่หลังเปิดหน้าเว็บใหม่
          </div>
        </>
      )}

      {tab === "disc" && (
        <>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#072d6b", marginBottom: 6 }}>{discForm.editing ? `✏️ แก้ไข ${discForm.part_code}` : "➕ เพิ่มอะไหล่ที่ยกเลิกการผลิต"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={discForm.brand} onChange={(e) => setDiscForm({ ...discForm, brand: e.target.value })} style={inp}>
                <option value="HONDA">HONDA</option><option value="YAMAHA">YAMAHA</option><option value="OTHER">อื่น ๆ</option>
              </select>
              <input value={discForm.part_code} disabled={discForm.editing} onChange={(e) => setDiscForm({ ...discForm, part_code: e.target.value })} placeholder="รหัสอะไหล่" style={{ ...inp, width: 170, fontFamily: "monospace", background: discForm.editing ? "#f3f4f6" : "#fff" }} />
              <input value={discForm.part_name} onChange={(e) => setDiscForm({ ...discForm, part_name: e.target.value })} placeholder="ชื่ออะไหล่ (เว้นได้ถ้ามีในไฟล์สต๊อก)" style={{ ...inp, width: 240 }} />
              <label style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 6, alignItems: "center" }}>วันที่ประกาศ
                <input type="date" value={discForm.announced_date} onChange={(e) => setDiscForm({ ...discForm, announced_date: e.target.value })} style={inp} /></label>
              <input value={discForm.note} onChange={(e) => setDiscForm({ ...discForm, note: e.target.value })} placeholder="หมายเหตุ เช่น เลขที่ประกาศ" style={{ ...inp, width: 240 }}
                onKeyDown={(e) => { if (e.key === "Enter") saveDisc(); }} />
              <button onClick={saveDisc} disabled={saving} style={btn("#15803d")}>{saving ? "กำลังบันทึก…" : "💾 บันทึก"}</button>
              {discForm.editing ? <button onClick={() => setDiscForm(EMPTY_DISC)} style={btn("#6b7280")}>ยกเลิก</button> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {[["ยกเลิกการผลิตทั้งหมด", discStats.total, "#374151"], ["ยังมีของในสต๊อก", discStats.withStock, "#b45309"], ["มีรหัสทดแทนแล้ว", discStats.withRepl, "#1d4ed8"]].map(([l, v, c]) => (
              <div key={l} style={{ ...card, minWidth: 150 }}><div style={{ fontSize: 11, color: "#6b7280" }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div></div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นรหัส / ชื่อ / หมายเหตุ" style={{ ...inp, width: 280 }} />
            <select value={brand} onChange={(e) => setBrand(e.target.value)} style={inp}>
              <option value="ALL">ทุกยี่ห้อ</option><option value="HONDA">HONDA</option><option value="YAMAHA">YAMAHA</option><option value="OTHER">อื่น ๆ</option>
            </select>
            <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> เฉพาะที่ยังมีสต๊อก</label>
            <button onClick={loadDisc} disabled={loading} style={btn("#072d6b")}>{loading ? "กำลังโหลด…" : "Refresh"}</button>
            <button onClick={() => window.print()} style={btn("#6b7280")}>🖨️ พิมพ์</button>
            <span style={{ fontSize: 12, color: "#6b7280" }}>แสดง {discVisible.length} จาก {disc.length} รายการ</span>
          </div>

          <div style={{ ...card, padding: 0, overflow: "auto", maxHeight: "62vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>ยี่ห้อ</th><th style={th}>รหัสอะไหล่</th><th style={th}>ชื่อ</th><th style={th}>สต๊อกคงเหลือ</th>
                  <th style={th}>รหัสทดแทน / สต๊อก</th><th style={th}>วันที่ประกาศ / หมายเหตุ</th><th style={th}>ที่มา</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {discVisible.length === 0 && !loading && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#6b7280", padding: 24 }}>{disc.length ? "ไม่พบรายการที่ค้น" : "ยังไม่มีรายการอะไหล่ที่ยกเลิกการผลิต"}</td></tr>}
                {discVisible.map((r, i) => {
                  const b = String(r.brand || "").toUpperCase();
                  return (
                    <tr key={r.part_key} style={{ background: i % 2 ? "#fafafa" : "#fff" }}>
                      <td style={td}><span style={{ fontWeight: 700, color: b === "HONDA" ? "#dc2626" : b === "YAMAHA" ? "#2563eb" : "#6b7280" }}>{b === "OTHER" ? "อื่น ๆ" : (r.brand || "-")}</span></td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{r.part_code}</td>
                      <td style={td}>{r.part_name || "-"}{r.product_group && <div style={{ fontSize: 11, color: "#b45309" }}>หมุนเร็ว {r.product_group}</div>}</td>
                      <td style={td}><StockCell stock={r.stock} /></td>
                      <td style={td}>
                        {(r.replacements || []).length === 0 ? <span style={{ color: "#9ca3af" }}>ยังไม่มี</span> : r.replacements.map((p, j) => (
                          <div key={j} style={{ marginBottom: 2 }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8" }}>{p.code}</span> <span style={{ fontSize: 12, color: "#6b7280" }}>{p.name || ""}</span>
                            <span style={{ fontSize: 12 }}> · {sumQty(p.stock) > 0 ? p.stock.map((s) => `${num(s.qty)} ${s.source}`).join(", ") : <span style={{ color: "#9ca3af" }}>ไม่มีสต๊อก</span>}</span>
                          </div>
                        ))}
                      </td>
                      <td style={{ ...td, fontSize: 12 }}>{r.announced_date ? <div style={{ whiteSpace: "nowrap" }}>{fmtDate(r.announced_date)}</div> : null}{r.note || (r.announced_date ? "" : "-")}</td>
                      <td style={{ ...td, fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                        {r.in_fast && <div>รายงานอะไหล่หมุนเร็ว</div>}
                        {r.in_manual && <div>บันทึกเอง{r.created_by ? ` · ${r.created_by}` : ""} {fmtDate(r.created_date)}</div>}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => { setDiscForm({ editing: true, brand: ["HONDA", "YAMAHA"].includes(b) ? b : "OTHER", part_code: r.part_code || "", part_name: r.part_name || "", announced_date: r.announced_date || "", note: r.note || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={mini("#2563eb")}>แก้ไข</button>
                        {isAdmin && <button onClick={() => deleteDisc(r)} style={mini("#dc2626")}>เอาออก</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
            รวมรหัสที่ติ๊ก "ยกเลิกผลิต" ในรายงานอะไหล่หมุนเร็ว กับรหัสที่เพิ่มในหน้านี้ · เพิ่มรหัสที่อยู่ในรายงานอะไหล่หมุนเร็ว ระบบจะติ๊กยกเลิกผลิตที่นั่นให้ด้วย (รหัสนั้นจะไม่ขึ้นในหน้าจัดการสต๊อกหมุนเร็ว) · "รหัสทดแทน" มาจากแท็บรายการอะไหล่ทดแทน · เอาออกได้เฉพาะ admin
          </div>
        </>
      )}
    </div>
  );
}
