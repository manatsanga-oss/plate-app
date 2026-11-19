import React, { useEffect, useRef, useState } from "react";

// ปุ่ม "ดึงจากใบประเมิน" ในฟอร์มสั่งซื้ออะไหล่ — เลือกเลขที่ใบประเมินราคา (part_quotes จากหน้าค้นรูปอะไหล่)
// แล้วส่งใบทั้งใบ (รวม items) กลับทาง onPick ให้หน้าที่เรียกเติมรายการอะไหล่เอง (user 2026-11-19)
const QUOTE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-quote-api";

async function quoteApi(body) {
  const res = await fetch(QUOTE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const raw = await res.text();
  const d = raw.trim() ? JSON.parse(raw) : [];
  return Array.isArray(d) ? d : d?.data || [];
}

const thDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear() + 543).slice(-2)}`;
};
const digits = (s) => String(s || "").replace(/\D/g, "");
// ตัดคำนำหน้า/รหัสลูกค้า/ช่องว่าง ให้เทียบชื่อใบประเมินกับชื่อลูกค้าของใบมัดจำได้
const nameKey = (s) => String(s || "").replace(/^RC-\d+-\d+\s*-\s*/i, "").replace(/^(นาย|นางสาว|นาง|น\.ส\.|mr\.?|mrs\.?|ms\.?)\s*/i, "").replace(/[\s\-.]/g, "").toLowerCase();

export default function QuotePickerButton({ onPick, customerName, customerPhone }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);   // null = ยังไม่โหลด
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState("");     // quote_no ที่กำลังดึงรายการ
  const [err, setErr] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setErr(""); setKw("");
    try { setList(await quoteApi({ action: "list_quotes" })); }   // โหลดใหม่ทุกครั้งที่เปิด — ใบที่เพิ่งออกต้องขึ้นทันที
    catch { setList([]); setErr("โหลดรายการใบประเมินไม่สำเร็จ"); }
  }

  async function pick(row) {
    setBusy(row.quote_no); setErr("");
    try {
      const rows = await quoteApi({ action: "get_quote", quote_no: row.quote_no });
      const full = rows[0];
      if (!full) { setErr(`ไม่พบใบประเมิน ${row.quote_no}`); return; }
      let items = full.items;
      if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
      onPick({ ...full, items: Array.isArray(items) ? items : [] });
      setOpen(false);
    } catch { setErr("ดึงรายการใบประเมินไม่สำเร็จ"); }
    finally { setBusy(""); }
  }

  // ใบของลูกค้าคนเดียวกับใบมัดจำ (ชื่อหรือเบอร์ตรง) ขึ้นก่อน
  const myName = nameKey(customerName), myPhone = digits(customerPhone).slice(-9);
  const isMine = (r) => (myPhone.length === 9 && digits(r.customer_phone).slice(-9) === myPhone)
    || (myName.length >= 3 && nameKey(r.customer_name) && (nameKey(r.customer_name).includes(myName) || myName.includes(nameKey(r.customer_name))));
  const k = kw.trim().toLowerCase();
  const shown = (list || [])
    .filter((r) => !k || [r.quote_no, r.customer_name, r.customer_phone, r.model, r.color, r.created_by].some((x) => String(x || "").toLowerCase().includes(k)))
    .map((r) => ({ r, mine: isMine(r) }))
    .sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={toggle} style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
        ดึงจากใบประเมิน ▾
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.18)", zIndex: 100, width: 430, maxWidth: "90vw", textAlign: "left" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
            <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="ค้นหา เลขที่ใบประเมิน / ลูกค้า / เบอร์ / รุ่น"
              style={{ width: "100%", boxSizing: "border-box", padding: "6px 10px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 6 }} />
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {list == null ? <div style={{ padding: 12, fontSize: 13, color: "#64748b" }}>กำลังโหลด...</div>
              : shown.length === 0 ? <div style={{ padding: 12, fontSize: 13, color: "#64748b" }}>{err || "ไม่พบใบประเมิน"}</div>
              : shown.map(({ r, mine }) => (
                <div key={r.quote_no || r.id} onClick={() => !busy && pick(r)}
                  style={{ padding: "7px 12px", cursor: busy ? "wait" : "pointer", borderBottom: "1px solid #f1f5f9", background: mine ? "#f0fdfa" : "#fff", fontSize: 13, lineHeight: 1.45 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e0f2fe"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = mine ? "#f0fdfa" : "#fff"; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#0f766e", fontFamily: "monospace" }}>{r.quote_no}{busy === r.quote_no ? " …" : ""}</span>
                    <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>{thDate(r.created_at)} · {Number(r.grand_total || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ color: "#334155" }}>
                    {r.customer_name || "(ไม่ระบุลูกค้า)"}{r.customer_phone ? ` · ${r.customer_phone}` : ""}{mine ? " ✓ ลูกค้าคนนี้" : ""}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{[r.model, r.color].filter(Boolean).join(" · ") || "-"}</div>
                </div>
              ))}
          </div>
          {err && shown.length > 0 && <div style={{ padding: "6px 12px", fontSize: 12, color: "#dc2626" }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
