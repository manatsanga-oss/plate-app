import React, { useEffect, useState, useRef } from "react";
import CustomerFormModal from "./CustomerFormModal";

// ============================================================================
// Modal เลือกลูกค้า สำหรับหน้าบันทึกขายปลีก — 3 ทาง:
//   1) ค้นจากฐานข้อมูลลูกค้า (moto-sales-get-customers)
//   2) เพิ่มลูกค้าใหม่ (moto-sales-save-customer)  [+ กรอกเองก็คือกรอกในฟอร์มตรง ๆ]
//   3) สแกน QR ให้ลูกค้ากรอกเองผ่าน LINE LIFF (receipt-requests-api)
// เลือกแล้ว -> onSelect({ code, name, phone })
// ============================================================================
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const URL_GET = `${BASE}/moto-sales-get-customers`;
const URL_SAVE = `${BASE}/moto-sales-save-customer`;
const RECEIPT_API = `${BASE}/receipt-requests-api`;
const SEARCH_ALL_API = `${BASE}/booking-deposit-api`; // action: search_customers — ค้นรวม ฐานลูกค้า + QR/LINE + ใบขายปลีก + ประวัติขาย

const LIFF_PORPAO = "2010357741-OvPBYFXi";   // ป.เปา (SCY05/06)
const LIFF_SINGCHAI = "2010360709-hznV4KSo"; // สิงห์ชัย (SCY01/04/07)
const isPorpaoBranch = (bc) => { const c = String(bc || "").toUpperCase(); return c.startsWith("SCY05") || c.startsWith("SCY06"); };
// สาขา ป.เปา (SCY05/06) ไม่แนบ oa (LIFF bot-link แอด ป.เปา ให้); สาขาอื่น = สิงห์ชัย → แนบ oa เพื่อโชว์ปุ่มแอด สิงห์ชัย
const liffUrl = (refNo, branchCode) => { const porpao = isPorpaoBranch(branchCode); return `https://liff.line.me/${porpao ? LIFF_PORPAO : LIFF_SINGCHAI}?ref=${encodeURIComponent(refNo)}${porpao ? "" : "&oa=singchai"}`; };
const qrImageUrl = (data, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;

// พิมพ์ QR ให้ลูกค้าสแกน (กระดาษแผ่นเดียว: หัวเรื่อง + เลขอ้างอิง + QR ใหญ่ + วิธีใช้)
function printQrSheet(refNo, branchCode, branchName) {
  const qr = qrImageUrl(liffUrl(refNo, branchCode), 420);
  const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>QR ${esc(refNo)}</title>
<style>
*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}
body{margin:0;padding:30px;text-align:center;color:#222}
h2{margin:0 0 4px}
.ref{font-size:20px;font-weight:800;font-family:monospace;margin:8px 0}
img{width:420px;max-width:90%;border:1px solid #ddd;border-radius:12px;padding:10px}
.hint{margin-top:14px;font-size:15px;color:#444;line-height:1.7}
.branch{margin-top:10px;color:#888;font-size:13px}
@media print{body{padding:10px}}
</style></head><body>
<h2>📷 สแกน QR ด้วยแอป LINE</h2>
<div>แอดเพื่อน + กรอกข้อมูลลูกค้าด้วยตัวเอง</div>
<div class="ref">${esc(refNo)}</div>
<img src="${esc(qr)}" onload="setTimeout(function(){window.print()},150)">
<div class="hint">1. เปิดแอป LINE แล้วสแกน QR นี้<br>2. กดเพิ่มเพื่อน (ถ้ายังไม่ได้เพิ่ม)<br>3. กรอกชื่อ-ที่อยู่-เบอร์โทร แล้วกดส่ง</div>
${branchName ? `<div class="branch">สาขา: ${esc(branchName)}</div>` : ""}
</body></html>`;
  const w = window.open("", "_blank", "width=560,height=760");
  if (!w) return false;
  w.document.write(html); w.document.close(); w.focus();
  return true;
}

const fullName = (c) => [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim();
const TITLE_OPTS = ["นาย", "นาง", "นางสาว", "บริษัท", "หจก.", "อื่นๆ"];

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : {};
}

export default function CustomerPickerModal({ currentUser, onSelect, onClose }) {
  const [tab, setTab] = useState("search");

  // หลังบันทึกลูกค้าใหม่จากฟอร์มเต็ม → หา customer_id แล้วเลือกเลย
  async function handleAddSaved(saved) {
    let code = saved.customer_id != null ? String(saved.customer_id) : "";
    if (!code) {
      try {
        const list = await postJson(URL_GET, {});
        if (Array.isArray(list)) {
          const match = [...list].reverse().find((c) =>
            (saved.id_number && c.id_number === saved.id_number) ||
            (saved.phone && c.phone === saved.phone) ||
            (c.first_name === saved.first_name && c.last_name === saved.last_name)
          );
          if (match && match.customer_id != null) code = String(match.customer_id);
        }
      } catch { /* ignore — ใช้ชื่อที่กรอกแทน */ }
    }
    const name = [saved.title, saved.first_name, saved.last_name].filter(Boolean).join(" ").trim();
    onSelect({ code, name, phone: saved.phone || "", province: saved.addr_province || "" });
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>เลือกลูกค้า</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#667085" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { k: "search", l: "🔍 ค้นจากฐานข้อมูล" },
            { k: "add", l: "＋ เพิ่มลูกค้าใหม่" },
            { k: "qr", l: "📷 สแกน QR ให้ลูกค้ากรอก" },
          ].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} style={tabBtn(tab === t.k)}>{t.l}</button>
          ))}
        </div>

        {tab === "search" && <SearchTab onSelect={onSelect} />}
        {tab === "add" && <CustomerFormModal onClose={() => setTab("search")} onSaved={handleAddSaved} />}
        {tab === "qr" && <QrTab currentUser={currentUser} onSelect={onSelect} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// แท็บ 1: ค้นจากฐานข้อมูล — ค้นรวมหลายตาราง:
//   ฐานลูกค้า (เพิ่มข้อมูลลูกค้า) + QR/LINE (receipt_requests) + ใบขายปลีก + ประวัติขาย
// ผ่าน booking-deposit-api action search_customers
// ถ้า API นั้นยังไม่ active → fallback ค้นเฉพาะฐานลูกค้า (แบบเดิม)
// ---------------------------------------------------------------------------
function SearchTab({ onSelect }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [kw, setKw] = useState("");
  const [err, setErr] = useState("");

  async function search() {
    const q = kw.trim();
    if (!q) { setErr("กรอกคำค้นหา"); return; }
    setLoading(true); setErr(""); setSearched(true);
    let out = [];
    try {
      const d = await postJson(SEARCH_ALL_API, { action: "search_customers", keyword: q });
      const arr = Array.isArray(d) ? d.filter((x) => x && x.customer_name) : [];
      // กรองรายการซ้ำข้ามตาราง (ชื่อ+เบอร์เดียวกัน เก็บแถวแรก = ใหม่สุด)
      const seen = new Set();
      for (const c of arr) {
        const key = `${String(c.customer_name).replace(/\s+/g, "")}|${c.customer_phone || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          source: c.source || "", code: c.customer_code || "", name: c.customer_name,
          phone: c.customer_phone || "", address: c.customer_address || "",
          tax_id: c.customer_tax_id || "", line_user_id: c.line_user_id || "",
          province: c.customer_province || "",
        });
      }
    } catch {
      // fallback: ค้นเฉพาะตาราง customers แบบเดิม
      try {
        const all = await postJson(URL_GET, {});
        const ql = q.toLowerCase();
        out = (Array.isArray(all) ? all : [])
          .filter((c) => [c.first_name, c.last_name, c.nickname, c.id_number, c.phone, c.addr_province].filter(Boolean).join(" ").toLowerCase().includes(ql))
          .slice(0, 100)
          .map((c) => ({
            source: "ฐานลูกค้า", code: c.customer_id != null ? String(c.customer_id) : "",
            name: fullName(c) || "-", phone: c.phone || "", address: "",
            tax_id: c.id_number || "", line_user_id: "", province: c.addr_province || "",
          }));
      } catch { setErr("ค้นหาไม่สำเร็จ"); }
    } finally {
      setLoading(false);
    }
    setList(out);
  }

  function pick(c) {
    onSelect({ code: c.code, name: c.name, phone: c.phone, province: c.province, address: c.address, tax_id: c.tax_id, line_user_id: c.line_user_id });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="ค้นหา ชื่อ / เลขบัตร / เบอร์ — รวมฐานลูกค้า + QR/LINE + ประวัติขาย" style={{ ...inp, flex: 1 }} />
        <button onClick={search} disabled={loading} style={{ ...primaryBtn, whiteSpace: "nowrap" }}>{loading ? "..." : "🔍 ค้นหา"}</button>
      </div>
      {err && <div style={{ color: "#b42318", marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 10, maxHeight: 360, overflowY: "auto", border: "1px solid #eaecf0", borderRadius: 8 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>กำลังค้นหา…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>{searched ? "ไม่พบลูกค้า" : "พิมพ์คำค้นหาแล้วกด Enter หรือปุ่มค้นหา"}</div>
        ) : (
          list.map((c, i) => (
            <div key={i} onClick={() => pick(c)} style={rowItem}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                {c.source && <span style={srcChip}>{c.source}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#667085", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {c.phone && <span>📞 {c.phone}</span>}
                {c.tax_id && <span>🪪 {c.tax_id}</span>}
                {c.province && <span>📍 {c.province}</span>}
                {c.line_user_id && <span style={{ color: "#067647" }}>LINE ✓</span>}
              </div>
              {c.address && <div style={{ fontSize: 12, color: "#98a2b3", marginTop: 2 }}>{c.address}</div>}
            </div>
          ))
        )}
      </div>
      <div style={{ fontSize: 12, color: "#98a2b3", marginTop: 6 }}>{list.length} รายการ — คลิกเพื่อเลือก</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// แท็บ 2: เพิ่มลูกค้าใหม่ (quick add)
// ---------------------------------------------------------------------------
function AddTab({ onSelect }) {
  const [f, setF] = useState({ title: "นาย", first_name: "", last_name: "", phone: "", id_number: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [dup, setDup] = useState(null); // ลูกค้าเดิมที่เบอร์ตรงกันและมี LINE — ให้เลือกรายเดิมแทนการสร้างซ้ำ
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    if (!f.first_name.trim()) { setErr("กรอกชื่อลูกค้า"); return; }
    setSaving(true); setErr(""); setDup(null);
    // กันสร้างลูกค้าซ้ำ: เบอร์นี้มีลูกค้าในระบบที่ผูก LINE แล้ว → บังคับเลือกรายเดิม (ไม่งั้นใบขาย/ใบเสร็จส่ง LINE ไม่ได้)
    const phoneDigits = f.phone.replace(/[^0-9]/g, "");
    if (phoneDigits.length >= 9) {
      try {
        const res = await postJson(SEARCH_ALL_API, { action: "search_customers", keyword: phoneDigits });
        const hit = (Array.isArray(res) ? res : []).find((r) =>
          String(r.line_user_id || "").trim() &&
          String(r.customer_phone || "").replace(/[^0-9]/g, "").slice(-9) === phoneDigits.slice(-9)
        );
        if (hit) {
          setDup(hit);
          setErr(`เบอร์ ${f.phone} มีลูกค้าในระบบแล้ว: ${hit.customer_name || "-"}${hit.customer_code ? ` (${hit.customer_code})` : ""} · LINE ✓ — เลือกรายเดิมเพื่อให้ส่งใบขาย/ใบเสร็จทาง LINE ได้`);
          setSaving(false);
          return;
        }
      } catch { /* ค้นไม่ได้ — ให้บันทึกต่อตามปกติ */ }
    }
    try {
      await postJson(URL_SAVE, { ...f, gender: "ชาย", nationality: "ไทย", status: "active", contact_date: new Date().toISOString().slice(0, 10) });
      // ดึงรายชื่อกลับมาเพื่อหา customer_id ของคนที่เพิ่งเพิ่ม (match ด้วยเบอร์/ชื่อ)
      let code = "";
      try {
        const list = await postJson(URL_GET, {});
        if (Array.isArray(list)) {
          const match = [...list].reverse().find((c) =>
            (f.phone && c.phone === f.phone) ||
            (c.first_name === f.first_name && c.last_name === f.last_name)
          );
          if (match && match.customer_id != null) code = String(match.customer_id);
        }
      } catch { /* ignore — ใช้ชื่อที่กรอกแทน */ }
      onSelect({ code, name: [f.title, f.first_name, f.last_name].filter(Boolean).join(" ").trim(), phone: f.phone });
    } catch (e) {
      setErr("บันทึกลูกค้าไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "center" }}>
        <label style={lbl}>คำนำหน้า</label>
        <select value={f.title} onChange={set("title")} style={inp}>{TITLE_OPTS.map((t) => <option key={t}>{t}</option>)}</select>
        <label style={lbl}>ชื่อ *</label>
        <input value={f.first_name} onChange={set("first_name")} style={inp} />
        <label style={lbl}>นามสกุล</label>
        <input value={f.last_name} onChange={set("last_name")} style={inp} />
        <label style={lbl}>เบอร์โทร</label>
        <input value={f.phone} onChange={set("phone")} style={inp} />
        <label style={lbl}>เลขบัตร ปชช.</label>
        <input value={f.id_number} onChange={set("id_number")} style={inp} />
      </div>
      {err && <div style={{ color: "#b42318", marginTop: 10 }}>{err}</div>}
      {dup && (
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button type="button"
            onClick={() => onSelect({
              code: dup.customer_code || "", name: dup.customer_name || "", phone: dup.customer_phone || "",
              province: dup.customer_province || "", address: dup.customer_address || "",
              tax_id: dup.customer_tax_id || "", line_user_id: dup.line_user_id || "",
            })}
            style={{ ...primaryBtn, background: "#067647" }}>
            ✓ เลือกลูกค้าเดิมรายนี้
          </button>
        </div>
      )}
      <div style={{ textAlign: "right", marginTop: 14 }}>
        <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? "บันทึก…" : "💾 บันทึก & เลือก"}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// แท็บ 3: สแกน QR ให้ลูกค้ากรอกผ่าน LIFF
// ---------------------------------------------------------------------------
function QrTab({ currentUser, onSelect }) {
  const [refNo, setRefNo] = useState("");
  const [refInput, setRefInput] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  async function lookupRef() {
    const ref = refInput.trim();
    if (!ref) { setErr("กรอกเลขที่อ้างอิง"); return; }
    setErr(""); setStatus("⏳ กำลังตรวจสอบ…");
    await check(ref, false);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function createRef() {
    setLoading(true); setErr(""); setStatus(""); setRefNo("");
    try {
      const row = await postJson(RECEIPT_API, {
        action: "create_ref",
        created_by: currentUser?.username || currentUser?.name || "system",
        branch_code: currentUser?.branch_code || currentUser?.branch || "",
        branch_name: currentUser?.branch || "",
      });
      const r = Array.isArray(row) ? row[0] : row;
      if (!r || !r.ref_no) throw new Error(r?.error || "ไม่ได้รับเลขอ้างอิง");
      setRefNo(r.ref_no);
      setStatus("⏳ รอลูกค้าสแกน QR และกรอกข้อมูล…");
      startPolling(r.ref_no);
    } catch (e) {
      setErr("สร้าง QR ไม่สำเร็จ: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function startPolling(ref) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => check(ref, true), 4000);
  }

  async function check(ref, silent) {
    try {
      const row = await postJson(RECEIPT_API, { action: "get_request", ref_no: ref || refNo });
      const r = Array.isArray(row) ? row[0] : row;
      if (r && (r.status === "filled" || r.status === "issued") && r.customer_name) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("✅ ลูกค้ากรอกข้อมูลแล้ว");
        onSelect({ code: r.ref_no || "", name: r.customer_name, phone: r.phone || "", address: r.address || "", tax_id: r.tax_id || "", line_user_id: r.line_user_id || "", birth_date: r.birth_date || "", gender: r.gender || "" });
      } else if (!silent) {
        setStatus("⏳ ลูกค้ายังไม่ได้กรอกข้อมูล");
      }
    } catch (e) {
      if (!silent) setErr("ตรวจสอบไม่สำเร็จ: " + (e.message || e));
    }
  }

  return (
    <div style={{ textAlign: "center" }}>
      {/* มีเลขอ้างอิงอยู่แล้ว (สร้าง/พิมพ์ QR จากเมนูออกใบเสร็จ) → กรอกเพื่อดึงข้อมูล */}
      <div style={{ textAlign: "left", marginBottom: 12 }}>
        <label style={lbl}>มีเลขที่อ้างอิงอยู่แล้ว? กรอก/สแกนเพื่อดึงข้อมูลลูกค้า</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input autoFocus value={refInput} onChange={(e) => setRefInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupRef()}
            placeholder="กรอก/สแกนเลขอ้างอิง เช่น RC-20260531-0001" style={{ ...inp, flex: 1 }} />
          <button onClick={lookupRef} style={{ ...primaryBtn, background: "#2563eb", whiteSpace: "nowrap" }}>🔍 ค้นหา</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", color: "#98a2b3", fontSize: 12 }}>
        <div style={{ flex: 1, height: 1, background: "#eaecf0" }} /> หรือสร้าง QR ใหม่ <div style={{ flex: 1, height: 1, background: "#eaecf0" }} />
      </div>
      {!refNo ? (
        <>
          <p style={{ color: "#667085" }}>กดสร้าง QR แล้วให้ลูกค้าสแกนด้วย LINE เพื่อกรอกข้อมูลเอง</p>
          <button onClick={createRef} disabled={loading} style={primaryBtn}>{loading ? "สร้าง…" : "📷 สร้าง QR ให้ลูกค้ากรอก"}</button>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{refNo}</div>
          <img src={qrImageUrl(liffUrl(refNo, currentUser?.branch_code || currentUser?.branch))} alt="QR" style={{ width: 240, height: 240, border: "1px solid #eaecf0", borderRadius: 8 }} />
          <div style={{ margin: "10px 0", color: status.startsWith("✅") ? "#067647" : "#b54708" }}>{status}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => check()} style={secondaryBtn}>🔄 ตรวจสอบตอนนี้</button>
            <button onClick={() => { if (!printQrSheet(refNo, currentUser?.branch_code || currentUser?.branch, currentUser?.branch || "")) setErr("เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)"); }} style={{ ...primaryBtn, background: "#2563eb" }}>🖨️ พิมพ์ QR</button>
          </div>
        </>
      )}
      {err && <div style={{ color: "#b42318", marginTop: 10 }}>{err}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
const overlay = { position: "fixed", inset: 0, background: "rgba(16,24,40,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "60px 16px", overflowY: "auto" };
const modal = { background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 520, boxShadow: "0 20px 40px rgba(0,0,0,.2)" };
const inp = { width: "100%", padding: "9px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8, boxSizing: "border-box" };
const lbl = { fontSize: 14, color: "#344054" };
const rowItem = { padding: "10px 14px", borderBottom: "1px solid #f2f4f7", cursor: "pointer" };
const srcChip = { fontSize: 11, fontWeight: 700, color: "#175cd3", background: "#eff8ff", border: "1px solid #b2ddff", borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap", alignSelf: "flex-start" };
const tabBtn = (active) => ({ flex: 1, padding: "8px 6px", fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: active ? "none" : "1px solid #d0d5dd", background: active ? "#2563eb" : "#fff", color: active ? "#fff" : "#344054" });
const primaryBtn = { padding: "10px 18px", fontSize: 15, fontWeight: 700, color: "#fff", background: "#2e9e4f", border: "none", borderRadius: 8, cursor: "pointer" };
const secondaryBtn = { padding: "8px 16px", fontSize: 14, fontWeight: 600, color: "#344054", background: "#fff", border: "1px solid #d0d5dd", borderRadius: 8, cursor: "pointer" };
