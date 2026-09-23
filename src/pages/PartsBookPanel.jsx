import React, { useMemo, useState } from "react";

/*
  โหมด "คู่มือรายการอะไหล่" (สมุดภาพอะไหล่รายบล็อก E-1..F-34) ในหน้าค้นรูปอะไหล่
  - ข้อมูลจาก src/data/partsbooks/<slug>_parts_book.json (สร้างด้วย tools/build_parts_book.py จาก PL-*.PDF)
  - grid บล็อกแยกหมวด → กดบล็อก = รูป diagram + ตารางอะไหล่
  - รายการที่ไม่ใช้กับ แบบ/type ที่เลือก แสดงจาง ๆ (คอลัมน์จำนวน P/S/T + หมายเหตุ type ในเล่ม)
  - ค้นหาด้วยรหัส/ชื่อไทย/ชื่ออังกฤษ → เด้งไปบล็อกที่มี + ไฮไลต์แถว
  - ดับเบิลคลิกแถว (หรือปุ่ม +) → เพิ่ม/ยกเลิก ลง pick-list ของหน้าหลัก (ราคาจาก part-price-api)
*/

const normCode = (s) => String(s || "").toUpperCase().replace(/[\s\-._/()]/g, "");
const typeTokOf = (t) => ((String(t || "").toUpperCase().match(/\d?TH/) || [])[0] || "");

// จับคู่ "แบบ" ของ cascade (จากสมุดชุดสี) กับ variant ในคู่มือ — ตรงตัวก่อน, ไม่ตรงลอง prefix (ชุดสี ACB160CAT vs คู่มือ ACB160CATN/CATR/CATV) เลือกตัวที่มี type ที่เลือก
const YEAR_SEQ = "ABCDEFGHJKLMNPRSTVWXY";   // ตัวอักษรปีรุ่น Honda ท้ายรหัสแบบ
const yearDist = (a, b) => { const i = YEAR_SEQ.indexOf(a), j = YEAR_SEQ.indexOf(b); return i < 0 || j < 0 ? 99 : Math.abs(i - j); };
// คืน {variant, near}: ตรงตัว → prefix (เลือกตัวที่มี type) → แบบใกล้เคียงต่างแค่ตัวอักษรปี (near=true, เช่น CSFM → CSFL)
function findVariant(book, baeb, type) {
  if (!book || !baeb) return null;
  const nb = normCode(baeb);
  const vs = book.variants || [];
  const exact = vs.find((v) => normCode(v.model_code) === nb);
  if (exact) return { variant: exact, near: false };
  const tok = typeTokOf(type);
  const pref = vs.filter((v) => normCode(v.model_code).startsWith(nb) || nb.startsWith(normCode(v.model_code)));
  if (pref.length) return { variant: pref.find((v) => tok && (v.types || []).some((t) => typeTokOf(t) === tok)) || pref[0], near: false };
  const stem = nb.slice(0, -1), yr = nb.slice(-1);
  const cands = vs.map((v) => ({ v, d: normCode(v.model_code).slice(0, -1) === stem ? yearDist(yr, normCode(v.model_code).slice(-1)) : 99 })).filter((x) => x.d < 99).sort((a, b) => a.d - b.d);
  return cands.length ? { variant: cands[0].v, near: true } : null;
}

// แถวนี้ใช้กับ แบบ/type ที่เลือกไหม (null = เล่มไม่ระบุ → ถือว่าใช้)
function rowApplies(row, variant, type) {
  if (!variant) return true;
  const q = row.qty && row.qty[variant.col];
  if (row.qty && Object.keys(row.qty).length && (q == null || q === "-")) return false;
  const tok = typeTokOf(type);
  const noteToks = (String(row.note || "").toUpperCase().match(/\d?TH\b/g) || []);
  if (tok && noteToks.length && !noteToks.includes(tok)) return false;
  return true;
}

export default function PartsBookPanel({ book, baeb, type, modelName, isPicked, togglePart }) {
  const [selBlock, setSelBlock] = useState(null); // block code
  const [q, setQ] = useState("");
  const [hiCode, setHiCode] = useState("");      // รหัสที่ไฮไลต์หลังค้นหา
  const [onlyApplicable, setOnlyApplicable] = useState(false);
  const [selRef, setSelRef] = useState(null);     // หมายเลขบนรูปที่กด ("*" = ทั้งหมด) — รายการขึ้นเฉพาะเลขที่เลือก

  const vm = findVariant(book, baeb, type);
  const variant = vm?.variant || null;
  const nearVariant = !!vm?.near;
  const blocks = useMemo(() => book.blocks || [], [book]);
  const block = blocks.find((b) => b.code === selBlock) || null;
  const blockIdx = block ? blocks.indexOf(block) : -1;
  // หมายเลขบนรูป (ลำดับ) ของบล็อกนี้ เรียงตามตัวเลข + สถานะว่าเลขนั้นมีรายการที่ใช้กับแบบ/type ที่เลือกไหม
  const refList = useMemo(() => {
    const m = new Map();
    for (const p of block?.parts || []) {
      const r = String(p.ref || "");
      if (!m.has(r)) m.set(r, { ref: r, ok: false, n: 0 });
      const e = m.get(r); e.n++; if (rowApplies(p, variant, type)) e.ok = true;
    }
    return [...m.values()].sort((a, b) => (Number(a.ref) || 0) - (Number(b.ref) || 0));
  }, [block, variant, type]);
  const refRows = (block?.parts || []).filter((p) => selRef === "*" || String(p.ref) === selRef);
  const openBlock = (code, code2) => {
    setSelBlock(code); setHiCode(code2 || "");
    const b = blocks.find((x) => x.code === code);
    const hit = code2 && b ? (b.parts || []).find((p) => p.code === code2) : null;
    setSelRef(hit ? String(hit.ref) : null); // เปิดจากผลค้นหา → กดเลขของรหัสนั้นให้เลย
  };

  // ค้นหา: รหัส / ชื่อไทย / ชื่ออังกฤษ / ชื่อบล็อก
  const query = q.trim();
  const hits = useMemo(() => {
    if (!query || query.length < 2) return null;
    const qq = query.toUpperCase();
    const qn = normCode(query);
    const out = [];
    for (const b of blocks) {
      for (const p of b.parts || []) {
        const codeHit = qn && normCode(p.code).includes(qn);
        const nameHit = (p.name_th || "").includes(query) || (p.name_en || "").toUpperCase().includes(qq);
        if (codeHit || nameHit) out.push({ block: b, part: p, applies: rowApplies(p, variant, type) });
        if (out.length >= 80) return out;
      }
    }
    return out;
  }, [query, blocks, variant, type]);
  const blockHits = useMemo(() => {
    if (!query || query.length < 2) return [];
    const qq = query.toUpperCase();
    return blocks.filter((b) => b.code.toUpperCase() === qq || (b.name_th || "").includes(query) || (b.name_en || "").toUpperCase().includes(qq));
  }, [query, blocks]);

  const openHit = (h) => { openBlock(h.block.code, h.part.code); setQ(""); };
  const applyLabel = variant ? `${variant.model_code} ${typeTokOf(type) || type || ""}`.trim() : baeb;

  const printBlock = () => {
    if (!block) return;
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const rows = (block.parts || []).filter((p) => !onlyApplicable || rowApplies(p, variant, type));
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(modelName)} ${esc(block.code)}</title>
<style>@page{size:A4 landscape;margin:8mm} body{margin:0;font-family:Tahoma,sans-serif;font-size:11px} h2{font-size:14px;margin:0 0 6px} img{width:100%;display:block;margin-bottom:8px}
table{border-collapse:collapse;width:100%} th,td{border:1px solid #999;padding:2px 5px;text-align:left} .off{color:#999}</style></head><body>
<h2>${esc(modelName)} · ${esc(block.code)} ${esc(block.name_th)} ${esc(block.name_en)} · สำหรับ ${esc(applyLabel)}</h2>
${block.img ? `<img src="${esc(block.img)}">` : ""}
<table><tr><th>ลำดับ</th><th>หมายเลขอะไหล่</th><th>ชื่ออะไหล่</th><th>จำนวน</th><th>หมายเหตุ</th></tr>
${rows.map((p) => `<tr class="${rowApplies(p, variant, type) ? "" : "off"}"><td>${esc(p.ref)}</td><td>${esc(p.code)}</td><td>${esc(p.name_th)} <small>${esc(p.name_en)}</small></td><td>${esc(variant ? (p.qty || {})[variant.col] ?? "" : Object.values(p.qty || {}).join("/"))}</td><td>${esc(p.note)}</td></tr>`).join("")}
</table><script>window.onload=function(){var im=document.images[0];if(!im||im.complete){window.print();}else{im.onload=im.onerror=function(){window.print();};}}</script></body></html>`);
    w.document.close();
  };

  const card = { border: "1px solid #dbe3ef", borderRadius: 12, padding: 12, marginBottom: 12, background: "#fff" };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, color: "#0b2f6b" }}>
          📘 คู่มือรายการอะไหล่ {book.model}
          <span style={{ fontWeight: 400, color: "#64748b", marginLeft: 8, fontSize: 12.5 }}>
            {book.edition ? `ฉบับ ${book.edition} · ` : ""}แสดงสำหรับ <b style={{ color: "#0f172a" }}>{applyLabel}</b>
            {!variant && <span style={{ color: "#b45309" }}> (เล่มนี้ไม่มีแบบ {baeb} — แสดงทุกรายการ)</span>}
            {nearVariant && <span style={{ color: "#b45309" }}> (ไม่มีแบบ {baeb} ในเล่ม — ใช้แบบใกล้เคียง {variant.model_code})</span>}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส / ชื่ออะไหล่ (ไทย·อังกฤษ) / ชื่อบล็อก"
            style={{ width: 300, maxWidth: "70vw", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
          {q && <button onClick={() => setQ("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", fontSize: 16 }}>×</button>}
        </div>
      </div>

      {/* ผลค้นหา */}
      {hits && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, marginBottom: 10, background: "#f8fafc", maxHeight: 320, overflowY: "auto" }}>
          {blockHits.length > 0 && (
            <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {blockHits.map((b) => (
                <button key={b.code} onClick={() => { openBlock(b.code); setQ(""); }}
                  style={{ fontSize: 12.5, border: "1px solid #93c5fd", background: "#dbeafe", color: "#0b2f6b", borderRadius: 7, padding: "3px 10px", cursor: "pointer", fontWeight: 600 }}>
                  📂 {b.code} {b.name_th}
                </button>
              ))}
            </div>
          )}
          {hits.length === 0 && blockHits.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>ไม่พบ "{query}" ในเล่มนี้</div>
          ) : (
            hits.map((h, i) => (
              <div key={i} onClick={() => openHit(h)}
                style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 6px", borderRadius: 6, cursor: "pointer", fontSize: 13, opacity: h.applies ? 1 : 0.5 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e0f2fe")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <code style={{ fontWeight: 600, background: "#eef2f8", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap" }}>{h.part.code}</code>
                <span style={{ flex: 1 }}>{h.part.name_th} <span style={{ color: "#94a3b8", fontSize: 11.5 }}>{h.part.name_en}</span></span>
                <span style={{ color: "#1e3a8a", fontWeight: 600, whiteSpace: "nowrap" }}>{h.block.code} {h.block.name_th}</span>
                {!h.applies && <span style={{ fontSize: 11, color: "#b45309" }}>ไม่ใช้กับ {applyLabel}</span>}
              </div>
            ))
          )}
          {hits.length >= 80 && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>แสดง 80 รายการแรก — พิมพ์ให้เจาะจงขึ้น</div>}
        </div>
      )}

      {!block ? (
        /* grid บล็อกแยกหมวด (ดัชนีภาพประกอบ) */
        (book.sections || []).map((s) => {
          const list = blocks.filter((b) => b.code.split("-")[0] === s.key);
          if (!list.length) return null;
          return (
            <div key={s.key} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", margin: "4px 0 8px", paddingBottom: 4, borderBottom: "2px solid #0b2f6b" }}>{s.name} ({list.length} บล็อก)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
                {list.map((b) => (
                  <div key={b.code} onClick={() => openBlock(b.code)}
                    style={{ border: "1px solid #dbe3ef", borderRadius: 10, overflow: "hidden", cursor: "pointer", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#dbe3ef")}>
                    <div style={{ padding: "6px 10px", fontSize: 12.5, borderBottom: "1px solid #eef2f8", display: "flex", gap: 8, alignItems: "baseline" }}>
                      <b style={{ color: "#0b2f6b", whiteSpace: "nowrap" }}>{b.code}</b>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${b.name_th} ${b.name_en}`}>{b.name_th}</span>
                    </div>
                    {b.img ? (
                      <img src={b.img} alt={`${b.code} ${b.name_th}`} loading="lazy" style={{ width: "100%", aspectRatio: "2 / 1", objectFit: "contain", display: "block", background: "#fff" }} />
                    ) : (
                      <div style={{ aspectRatio: "2 / 1", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>ไม่มีรูป</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        /* รายละเอียดบล็อก: รูป + ตาราง */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => { setSelBlock(null); setHiCode(""); setSelRef(null); }} style={btnGhost}>◀ กลับไปดัชนีภาพ</button>
              <button onClick={() => blockIdx > 0 && openBlock(blocks[blockIdx - 1].code)} disabled={blockIdx <= 0} style={btnGhost}>‹ ก่อนหน้า</button>
              <button onClick={() => blockIdx < blocks.length - 1 && openBlock(blocks[blockIdx + 1].code)} disabled={blockIdx >= blocks.length - 1} style={btnGhost}>ถัดไป ›</button>
              <select value={block.code} onChange={(e) => openBlock(e.target.value)} style={{ padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13 }}>
                {blocks.map((b) => (<option key={b.code} value={b.code}>{b.code} {b.name_th}</option>))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 12.5, color: "#334155", display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={onlyApplicable} onChange={(e) => setOnlyApplicable(e.target.checked)} /> เฉพาะที่ใช้กับ {applyLabel}
              </label>
              <button onClick={printBlock} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#0369a1", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>🖨️ พิมพ์</button>
              {block.img && <a href={block.img} target="_blank" rel="noopener" style={{ fontSize: 13, color: "#1e3a8a" }}>เปิดรูปเต็ม ↗</a>}
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            {block.code} · {block.name_th} <span style={{ color: "#64748b", fontWeight: 400, fontSize: 13 }}>{block.name_en}</span>
          </div>
          {block.img && (
            /* รูป + จุดกดทับหมายเลข (hotspots จาก tools/build_parts_book_hotspots.py) — ชี้เป็นรูปมือ กดแล้วขึ้นรายการของเลขนั้นด้านล่าง */
            <div style={{ position: "relative", width: "100%", lineHeight: 0, userSelect: "none", marginBottom: 8 }}>
              <img src={block.img} alt={`${block.code} ${block.name_th}`}
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" }} />
              {(block.hotspots || []).map((h, i) => {
                const active = selRef === h.ref;
                const okRef = refList.find((r) => r.ref === h.ref)?.ok;
                return (
                  <button key={i} onClick={() => { setSelRef(active ? null : h.ref); setHiCode(""); }}
                    title={`หมายเลข ${h.ref}${okRef ? "" : " (ไม่มีรายการที่ใช้กับ " + applyLabel + ")"}`}
                    className="pb-hot"
                    style={{
                      position: "absolute", left: `${h.x - h.w * 0.6}%`, top: `${h.y - h.h * 0.35}%`,
                      width: `${h.w * 2.2}%`, height: `${h.h * 1.7}%`, minWidth: 22, minHeight: 22,
                      padding: 0, cursor: "pointer", borderRadius: 6,
                      background: active ? "rgba(217,119,6,0.22)" : "transparent",
                      border: active ? "2px solid #d97706" : "2px solid transparent",
                    }} />
                );
              })}
              <style>{`.pb-hot:hover{background:rgba(37,99,235,0.16)!important;border-color:#2563eb!important}`}</style>
            </div>
          )}
          {/* ปุ่มหมายเลขบนรูป → กดแล้วขึ้นรายการของเลขนั้นด้านล่าง */}
          <div style={{ border: "1px solid #dbe3ef", borderRadius: 10, padding: "8px 10px", background: "#fbfcfe", marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, color: "#334155", marginBottom: 6 }}>
              🔢 กดหมายเลขบนรูปได้เลย หรือกดจากแถบนี้ <span style={{ color: "#94a3b8" }}>· เลขจาง = ไม่มีรายการที่ใช้กับ {applyLabel}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {refList.map((r) => {
                const active = selRef === r.ref;
                return (
                  <button key={r.ref} onClick={() => setSelRef(active ? null : r.ref)} title={`${r.n} รายการ`}
                    style={{
                      minWidth: 38, height: 34, padding: "0 8px", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer",
                      border: active ? "2px solid #d97706" : "1px solid #cbd5e1",
                      background: active ? "#fff7e8" : r.ok ? "#fff" : "#f1f5f9", color: active ? "#b45309" : r.ok ? "#0b2f6b" : "#94a3b8",
                      opacity: r.ok ? 1 : 0.6,
                    }}>
                    {r.ref || "?"}
                  </button>
                );
              })}
              <button onClick={() => setSelRef(selRef === "*" ? null : "*")}
                style={{ height: 34, padding: "0 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: selRef === "*" ? "2px solid #d97706" : "1px dashed #cbd5e1", background: "#fff", color: "#475569" }}>
                ทั้งหมด
              </button>
            </div>
          </div>
          {selRef == null ? (
            <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "14px 6px" }}>👆 กดหมายเลขบนแถบด้านบน เพื่อดูรายการอะไหล่ของเลขนั้น</div>
          ) : (
          <div style={{ overflowX: "auto" }}>
          <div style={{ fontSize: 12, color: "#2563eb", marginBottom: 6 }}>
            {selRef === "*" ? "ทุกรายการในบล็อกนี้" : `หมายเลข ${selRef}`} · ดับเบิลคลิกแถว (หรือกด +) เพื่อเพิ่มลงรายการ · แถวจาง = ไม่ใช้กับ {applyLabel}
          </div>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 52, textAlign: "right" }}>ลำดับ</th>
                  <th style={{ width: 150 }}>หมายเลขอะไหล่</th>
                  <th>ชื่ออะไหล่</th>
                  <th style={{ width: 70, textAlign: "center" }} title={variant ? `คอลัมน์ ${variant.col} = ${variant.model_code}` : "จำนวนตามคอลัมน์ในเล่ม"}>จำนวน</th>
                  <th style={{ width: 130 }}>หมายเหตุ</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {refRows.filter((p) => !onlyApplicable || rowApplies(p, variant, type)).map((p, i) => {
                  const ok = rowApplies(p, variant, type);
                  const sel = isPicked(p.code, modelName);
                  const hi = hiCode && p.code === hiCode;
                  const qty = variant ? ((p.qty || {})[variant.col] ?? "") : Object.values(p.qty || {}).join("/");
                  return (
                    <tr key={p.code + i} onDoubleClick={() => togglePart({ code: p.code }, { color: `${block.code} ${block.name_th}`, name: p.name_th })}
                      ref={hi ? (el) => el && el.scrollIntoView({ block: "center", behavior: "smooth" }) : undefined}
                      style={{ opacity: ok ? 1 : 0.42, background: hi ? "#fef9c3" : sel ? "#f0fdf4" : "transparent", cursor: "pointer" }}
                      title={ok ? "" : `ไม่ใช้กับ ${applyLabel}`}>
                      <td style={{ textAlign: "right", color: p.alt ? "#94a3b8" : "#0f172a" }}>{p.alt ? "" : p.ref}</td>
                      <td><code style={{ fontWeight: 600, background: sel ? "#dcfce7" : "#eef2f8", borderRadius: 5, padding: "1px 7px" }}>{p.code}</code></td>
                      <td style={{ textAlign: "left" }}>{p.name_th}<div style={{ fontSize: 11, color: "#94a3b8" }}>{p.name_en}</div></td>
                      <td style={{ textAlign: "center" }}>{qty}</td>
                      <td style={{ fontSize: 12, color: "#475569", textAlign: "left" }}>{p.note}</td>
                      <td>
                        <button onClick={() => togglePart({ code: p.code }, { color: `${block.code} ${block.name_th}`, name: p.name_th })}
                          style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "2px 10px", cursor: "pointer", border: sel ? "1px solid #16a34a" : "1px solid #cbd5e1", background: sel ? "#dcfce7" : "#fff", color: sel ? "#15803d" : "#334155" }}>
                          {sel ? "✓ เพิ่มแล้ว" : "+ เพิ่ม"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnGhost = { fontSize: 12.5, fontWeight: 600, border: "1px solid #cbd5e1", background: "#fff", color: "#1e3a8a", borderRadius: 7, padding: "4px 10px", cursor: "pointer" };
