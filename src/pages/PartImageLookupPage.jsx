import React, { useState } from "react";
import catalog from "../data/parts_catalog";
import CustomerPickerModal from "./CustomerPickerModal";
import { openQuotePrint, recordToQuoteData, quoteApi, nowParts, QUOTE_URL } from "./quotePrint";

const QUOTE_LINE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/part-quote-line";

/*
  ค้นรูปอะไหล่ (ชุดสี)
  - เลือกแบบ cascade 4 ชั้น: รุ่น → แบบ → type → สี (อิงข้อมูลรถ master; แสดงเฉพาะที่มีรูป)
  - จุดกดทับรหัสบนรูป · ดับเบิลคลิก → เพิ่ม/ยกเลิก ลงตาราง · ดึง ชื่อ+ราคา จาก part-price-api
  - แต่ละสีใน 7 เล่ม ถูก tag แบบ(model_code)+type ให้ตรงกับ master (tools/_enrich)
*/

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/part-price-api";
const NO_BAEB = "(ไม่ระบุแบบ)";

const fmtMoney = (v) =>
  v == null || v === "" || isNaN(Number(v))
    ? null
    : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const uniq = (arr) => [...new Set(arr)];

async function fetchPrice(code) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_price", codes: [code] }),
    });
    if (!res.ok) return null;
    const arr = await res.json().catch(() => []);
    const rows = Array.isArray(arr) ? arr : arr?.data || [];
    const row = rows.find((r) => String(r.part_code) === String(code)) || rows[0];
    return row ? { name: row.name || "", price: row.price } : { name: "", price: null };
  } catch {
    return null;
  }
}

export default function PartImageLookupPage({ currentUser } = {}) {
  const [modelIdx, setModelIdx] = useState(0);
  const [selBaeb, setSelBaeb] = useState("");
  const [selType, setSelType] = useState("");
  const [colorPage, setColorPage] = useState(null);
  const [picked, setPicked] = useState([]); // [{model, code, color, name, price, loading}]
  const [searchQ, setSearchQ] = useState("");
  const [searchMsg, setSearchMsg] = useState("");

  // ค้นด้วยรหัสรุ่น/แบบจากเอกสาร เช่น "AFS110MCFS 3TH" → เด้งไป รุ่น/แบบ/type ที่ตรง
  const runSearch = (raw) => {
    const q = (raw || "").trim().toUpperCase();
    if (!q) { setSearchMsg(""); return; }
    const codePart = q.replace(/\s+/g, "");
    const typeTokens = q.match(/\d?TH/g) || [];
    const typeTok = typeTokens.find((t) => /\d/.test(t)) || typeTokens[0] || null;

    // 1) หา "รุ่น" จาก series ที่เป็น prefix (เลือก series ที่ยาวสุด)
    let bi = -1, bestLen = 0;
    catalog.forEach((m, i) => {
      const ser = (m.series || "").toUpperCase();
      if (ser && codePart.startsWith(ser) && ser.length > bestLen) { bi = i; bestLen = ser.length; }
    });
    if (bi < 0) catalog.forEach((m, i) => {
      const ser = (m.series || "").toUpperCase();
      if (ser && codePart.includes(ser) && ser.length > bestLen) { bi = i; bestLen = ser.length; }
      if (m.model.toUpperCase() === q) bi = i;
    });
    if (bi < 0) { setSearchMsg(`ไม่พบรุ่นที่ตรงกับ "${raw}"`); return; }

    const m = catalog[bi];
    const cols = m.colors || [];
    const lcp = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n; };
    // 2) เลือก "แบบ" จาก prefix ที่ตรงยาวสุด
    const baebs = [...new Set(cols.map((c) => c.model_code || NO_BAEB))];
    let bb = baebs[0], bl = -1;
    baebs.forEach((b) => { const l = lcp(codePart, (b || "").toUpperCase()); if (l > bl) { bl = l; bb = b; } });
    // 3) เลือก "type" จาก token ในข้อความ (ถ้ามีใน แบบ นั้น)
    const types = [...new Set(cols.filter((c) => (c.model_code || NO_BAEB) === bb).map((c) => c.type || "-"))];
    let bt = types[0];
    if (typeTok) { const hit = types.find((t) => t.toUpperCase().includes(typeTok)); if (hit) bt = hit; }

    setModelIdx(bi); setSelBaeb(bb); setSelType(bt); setColorPage(null);
    const typeNote = typeTok && !types.some((t) => t.toUpperCase().includes(typeTok)) ? ` (ไม่มี type ${typeTok} ใช้ ${bt} แทน)` : "";
    setSearchMsg(`พบ: ${m.model} · ${bb} · ${bt}${typeNote}`);
  };

  const model = catalog[modelIdx] || catalog[0];
  const allColors = model.colors || [];
  const pagesMap = model.pages || {};
  const baebOf = (c) => c.model_code || NO_BAEB;

  // --- cascade (derive-on-render: เลือกค่าที่ถูกต้องเสมอ แสดงเฉพาะที่มีรูป) ---
  const baebList = uniq(allColors.map(baebOf));
  const baeb = baebList.includes(selBaeb) ? selBaeb : baebList[0];
  const typeList = uniq(allColors.filter((c) => baebOf(c) === baeb).map((c) => c.type || "-"));
  const type = typeList.includes(selType) ? selType : typeList[0];
  const colorList = allColors.filter((c) => baebOf(c) === baeb && (c.type || "-") === type);
  const current = colorList.find((c) => String(c.page) === String(colorPage)) || colorList[0] || null;
  // รองรับสีที่มีหลายหน้า (เช่น FORZA350 = 2 หน้า/สี)
  const pageList = current ? (current.pages || [current.page]) : [];
  const imgList = current ? (current.imgs || [current.img]) : [];

  const isPicked = (code, m) => picked.some((x) => x.code === code && x.model === m);

  const togglePart = (p) => {
    const m = model.model;
    if (isPicked(p.code, m)) {
      setPicked((prev) => prev.filter((x) => !(x.code === p.code && x.model === m)));
      return;
    }
    setPicked((prev) =>
      prev.some((x) => x.code === p.code && x.model === m)
        ? prev
        : [...prev, { model: m, code: p.code, color: current?.name || "", name: null, price: null, loading: true }]
    );
    fetchPrice(p.code).then((info) => {
      setPicked((prev) =>
        prev.map((x) =>
          x.code === p.code && x.model === m
            ? { ...x, name: info?.name ?? "", price: info?.price ?? null, loading: false }
            : x
        )
      );
    });
  };
  const removeAt = (i) => setPicked((prev) => prev.filter((_, idx) => idx !== i));
  const clearAll = () => setPicked([]);

  // ---- เพิ่มรายการเอง (popup): คีย์รหัส → ค้นราคา → ถ้าไม่เจอพิมพ์ชื่อ/ราคาเอง ----
  const [showAdd, setShowAdd] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addStatus, setAddStatus] = useState("idle"); // idle|searching|found|notfound|dup

  const openAdd = () => { setShowAdd(true); setAddCode(""); setAddName(""); setAddPrice(""); setAddStatus("idle"); };
  const searchAdd = async () => {
    const code = addCode.trim();
    if (!code) return;
    setAddStatus("searching");
    const info = await fetchPrice(code);
    if (info && (info.name || info.price != null)) {
      setAddName(info.name || "");
      setAddPrice(info.price != null ? String(info.price) : "");
      setAddStatus("found");
    } else {
      setAddStatus("notfound"); // ปล่อยให้พิมพ์ชื่อ/ราคาเอง
    }
  };
  const confirmAdd = () => {
    const code = addCode.trim();
    if (!code) return;
    const m = model.model;
    if (isPicked(code, m)) { setAddStatus("dup"); return; }
    const priceNum = addPrice === "" ? null : Number(addPrice);
    setPicked((prev) => [...prev, { model: m, code, color: "เพิ่มเอง", name: addName.trim(), price: isNaN(priceNum) ? null : priceNum, loading: false }]);
    setShowAdd(false);
  };

  // ---- แก้ไขแถวในตาราง (ดับเบิลคลิกที่แถว → แก้ ชื่อ/ราคา) ----
  const [editIdx, setEditIdx] = useState(null);
  const updateRow = (i, field, value) =>
    setPicked((prev) => prev.map((x, idx) => (idx === i ? { ...x, [field]: value, loading: false } : x)));

  // ---- ใบประเมินราคา: ข้อมูลหัวเอกสาร + บันทึก/พิมพ์/ประวัติ ----
  const QFORM0 = { customer_code: "", customer_name: "", customer_phone: "", customer_address: "", customer_tax_id: "", customer_line_user_id: "",
    plate_no: "", model_year: "", mileage: "", vin: "", engine_no: "", problem: "", labor: "", labor_discount: "", parts_discount: "" };
  const [q, setQ] = useState(QFORM0);
  const setQF = (k, v) => setQ((p) => ({ ...p, [k]: v }));
  const [showCust, setShowCust] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNo, setSavedNo] = useState("");
  const [showHist, setShowHist] = useState(false);
  const [hist, setHist] = useState(null);

  // คำนวณเงิน (ราคาอะไหล่ = VAT-incl ตามฟอร์ม)
  const partsTotal = picked.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const laborNet = (Number(q.labor) || 0) - (Number(q.labor_discount) || 0);
  const partsNet = partsTotal - (Number(q.parts_discount) || 0);
  const grand = laborNet + partsNet;            // รวมภาษี
  const subtotal = grand / 1.07;                  // ก่อนภาษี
  const vat = grand - subtotal;                   // VAT 7%

  const buildPayload = () => ({
    created_by: currentUser?.name || currentUser?.username || "",
    customer_code: q.customer_code, customer_name: q.customer_name, customer_phone: q.customer_phone,
    customer_address: q.customer_address, customer_tax_id: q.customer_tax_id, customer_line_user_id: q.customer_line_user_id,
    model: model?.model || "", color: picked[0]?.color || current?.name || "",
    plate_no: q.plate_no, model_year: q.model_year, mileage: q.mileage, vin: q.vin, engine_no: q.engine_no, problem: q.problem,
    labor: Number(q.labor) || 0, labor_discount: Number(q.labor_discount) || 0,
    parts_total: partsTotal, parts_discount: Number(q.parts_discount) || 0,
    subtotal, vat, grand_total: grand,
    items: picked.map((p) => ({ code: p.code, name: p.name || "", model: p.model, color: p.color, qty: 1, price: Number(p.price) || 0, amount: Number(p.price) || 0 })),
  });

  const saveQuote = async () => {
    if (!picked.length) { alert("ยังไม่มีรายการอะไหล่"); return; }
    setSaving(true);
    try {
      const r = await quoteApi({ action: "save_quote", ...buildPayload() });
      const rows = Array.isArray(r) ? r : r?.data || [];
      const no = rows[0]?.quote_no || "";
      setSavedNo(no);
      alert("บันทึกใบประเมินสำเร็จ" + (no ? " เลขที่ " + no : ""));
    } catch (e) {
      alert("บันทึกไม่สำเร็จ: " + (e.message || e));
    } finally { setSaving(false); }
  };

  const printQuote = (quoteNo) => {
    const np = nowParts();
    openQuotePrint({
      quote_no: quoteNo || savedNo || "", date: np.date, time: np.time,
      created_by: currentUser?.name || currentUser?.username || "",
      customer_name: q.customer_name, customer_address: q.customer_address, customer_phone: q.customer_phone, customer_tax_id: q.customer_tax_id,
      model: (model?.model || "") + (current?.name ? " " + current.name : ""), color: current?.code || "",
      plate_no: q.plate_no, model_year: q.model_year, mileage: q.mileage, vin: q.vin, engine_no: q.engine_no, problem: q.problem,
      items: picked.map((p) => ({ code: p.code, name: p.name || "", amount: Number(p.price) || 0 })),
      labor: Number(q.labor) || 0, labor_discount: Number(q.labor_discount) || 0, laborNet,
      parts_total: partsTotal, parts_discount: Number(q.parts_discount) || 0, partsNet,
      subtotal, vat, grand_total: grand,
    });
  };

  // พิมพ์จากประวัติ (record จาก DB)
  const printSavedQuote = (rec) => openQuotePrint(recordToQuoteData(rec));

  // ส่งใบประเมินให้ลูกค้าทาง LINE (ต้องบันทึกก่อน + ลูกค้ามี LINE)
  const sendLine = async () => {
    if (!savedNo) { alert("กรุณาบันทึกใบประเมินก่อน"); return; }
    if (!q.customer_line_user_id) { alert("ลูกค้ารายนี้ยังไม่ได้ผูก LINE — เลือกลูกค้าที่มี LINE ✓"); return; }
    try {
      const res = await fetch(QUOTE_LINE_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_no: savedNo, line_user_id: q.customer_line_user_id,
          branch: currentUser?.branch_code || currentUser?.branch || "",
          customer_name: q.customer_name, model: model?.model || "", color: current?.name || "",
          grand_total: grand,
        }),
      });
      const ok = res.ok;
      const data = await res.json().catch(() => ({}));
      if (ok && data.success !== false) alert("ส่งใบประเมินให้ลูกค้าทาง LINE แล้ว ✅");
      else alert("ส่งไม่สำเร็จ: " + (data.error || "HTTP " + res.status));
    } catch (e) { alert("ส่งไม่สำเร็จ: " + (e.message || e)); }
  };

  const openHistory = async () => {
    setShowHist(true); setHist(null);
    try {
      const r = await quoteApi({ action: "list_quotes" });
      setHist(Array.isArray(r) ? r : r?.data || []);
    } catch { setHist([]); }
  };
  const reprint = async (quote_no) => {
    try {
      const r = await quoteApi({ action: "get_quote", quote_no });
      const rows = Array.isArray(r) ? r : r?.data || [];
      const rec = rows[0];
      if (!rec) { alert("ไม่พบใบประเมิน"); return; }
      printSavedQuote(rec);
    } catch (e) { alert("เปิดไม่สำเร็จ: " + (e.message || e)); }
  };

  const total = picked.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const selStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "#fff" };
  const lbl = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="page-title">🖼️ ค้นรูปอะไหล่ (ชุดสี)</h2>
        <button onClick={openHistory} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 13 }}>
          📋 ประวัติใบประเมิน
        </button>
      </div>

      {/* ค้นด้วยรหัสรุ่น/แบบจากเอกสาร */}
      <div className="form-card">
        <label style={lbl}>ค้นหาด้วยรหัสรุ่น/แบบ (จากเอกสารรถ)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(searchQ)}
            placeholder="เช่น AFS110MCFS 3TH, AFS125CSBT 2TH, ADV160AT 7TH"
            style={{ ...selStyle, flex: "1 1 260px" }}
          />
          <button className="btn-primary" onClick={() => runSearch(searchQ)} style={{ whiteSpace: "nowrap" }}>
            🔍 ค้นหา
          </button>
        </div>
        {searchMsg && (
          <div style={{ fontSize: 13, marginTop: 8, color: searchMsg.startsWith("ไม่พบ") ? "#b91c1c" : "#15803d" }}>
            {searchMsg}
          </div>
        )}
      </div>

      {/* cascade: รุ่น → แบบ → type → สี */}
      <div className="form-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: "1 1 160px" }}>
            <label style={lbl}>รุ่น</label>
            <select value={modelIdx} onChange={(e) => { setModelIdx(Number(e.target.value)); setSelBaeb(""); setSelType(""); setColorPage(null); }} style={selStyle}>
              {catalog.map((m, i) => (
                <option key={m.model} value={i}>{m.model}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={lbl}>แบบ</label>
            <select value={baeb} onChange={(e) => { setSelBaeb(e.target.value); setSelType(""); setColorPage(null); }} style={selStyle}>
              {baebList.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={lbl}>type</label>
            <select value={type} onChange={(e) => { setSelType(e.target.value); setColorPage(null); }} style={selStyle}>
              {typeList.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={lbl}>สี</label>
            <select value={current?.page ?? ""} onChange={(e) => setColorPage(e.target.value)} style={selStyle}>
              {colorList.map((c) => (
                <option key={c.page} value={c.page}>{c.name} ({c.code}){c.color_code ? ` · ${c.color_code}` : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* รูป + จุดกดทับ */}
      {current && (
        <div className="form-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>
              {model.model} · {baeb} · {type} · สี{current.name}{" "}
              <span style={{ color: "#64748b", fontWeight: 400 }}>({current.code}{current.color_code ? ` · ${current.color_code}` : ""})</span>
            </div>
            <a href={current.img} target="_blank" rel="noopener" style={{ fontSize: 13, color: "#1e3a8a" }}>
              เปิดรูปเต็ม ↗
            </a>
          </div>

          <div style={{ fontSize: 12, color: "#2563eb", marginBottom: 8 }}>
            👉 ดับเบิลคลิกที่รหัสบนรูป เพื่อเพิ่ม · ดับเบิลคลิกซ้ำที่เดิม เพื่อยกเลิก
          </div>

          {pageList.map((pg, idx) => {
            const pParts = pagesMap[String(pg)] || [];
            return (
              <div key={pg} style={{ marginBottom: idx < pageList.length - 1 ? 10 : 0 }}>
                {pageList.length > 1 && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    📄 หน้า {idx + 1}/{pageList.length}
                  </div>
                )}
                <div style={{ position: "relative", width: "100%", lineHeight: 0, userSelect: "none" }}>
                  <img
                    src={imgList[idx] || current.img}
                    alt={`${model.model} ${current.name} หน้า ${idx + 1}`}
                    style={{ width: "100%", height: "auto", borderRadius: 8, border: "1px solid #e2e8f0", display: "block" }}
                  />
                  {pParts.map((p) => {
                    const sel = isPicked(p.code, model.model);
                    const left = Math.max(0, p.x + p.w / 2 - 5);
                    return (
                      <button
                        key={p.code}
                        onDoubleClick={() => togglePart(p)}
                        title={`${p.code} (ดับเบิลคลิก: เลือก/ยกเลิก)`}
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          top: `${Math.max(0, p.y - 12)}%`,
                          width: "10%",
                          height: "15%",
                          background: sel ? "rgba(34,197,94,0.18)" : "transparent",
                          border: sel ? "2px solid #16a34a" : "1px solid transparent",
                          borderRadius: 6,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
            จุดสีเขียว = รหัสที่เพิ่มแล้ว · เปิดรูปเต็มเพื่อซูม
          </div>
        </div>
      )}

      {/* ปุ่มเพิ่มรายการเอง */}
      <div style={{ margin: "4px 0 8px" }}>
        <button className="btn-primary" onClick={openAdd} style={{ background: "#0369a1" }}>
          ➕ เพิ่มรายการ (คีย์รหัสเอง)
        </button>
      </div>

      {/* ตารางอะไหล่ที่เลือก */}
      {picked.length > 0 && (
        <div className="form-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>รายการอะไหล่ที่เลือก ({picked.length})</div>
            <button onClick={clearAll} style={{ fontSize: 13, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>
              ล้างทั้งหมด
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 50, textAlign: "right" }}>ลำดับ</th>
                  <th>รุ่น</th>
                  <th>รหัสอะไหล่</th>
                  <th>ชื่ออะไหล่</th>
                  <th>สี</th>
                  <th style={{ textAlign: "right" }}>ราคาขาย</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {picked.map((p, i) => {
                  const money = fmtMoney(p.price);
                  const editing = editIdx === i;
                  const cellInput = { width: "100%", padding: "4px 6px", border: "1px solid #93c5fd", borderRadius: 4, fontSize: 13 };
                  return (
                    <tr
                      key={`${p.model}-${p.code}-${i}`}
                      onDoubleClick={() => setEditIdx(i)}
                      style={{ background: editing ? "#eff6ff" : "transparent", cursor: editing ? "default" : "pointer" }}
                      title={editing ? "" : "ดับเบิลคลิกเพื่อแก้ไขชื่อ/ราคา"}
                    >
                      <td style={{ textAlign: "right", color: "#94a3b8" }}>{i + 1}</td>
                      <td style={{ fontSize: 12 }}>{p.model}</td>
                      <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 600, color: "#1e3a8a" }}>{p.code}</td>
                      <td>
                        {editing ? (
                          <input
                            value={p.name || ""}
                            onChange={(e) => updateRow(i, "name", e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && setEditIdx(null)}
                            placeholder="ชื่อสินค้า"
                            style={cellInput}
                            autoFocus
                          />
                        ) : p.loading ? <span style={{ color: "#94a3b8" }}>…</span> : (p.name || <span style={{ color: "#cbd5e1" }}>-</span>)}
                      </td>
                      <td style={{ fontSize: 12, color: "#64748b" }}>{p.color}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {editing ? (
                          <input
                            type="number"
                            min="0"
                            value={p.price ?? ""}
                            onChange={(e) => updateRow(i, "price", e.target.value === "" ? null : Number(e.target.value))}
                            onKeyDown={(e) => e.key === "Enter" && setEditIdx(null)}
                            placeholder="0.00"
                            style={{ ...cellInput, textAlign: "right" }}
                          />
                        ) : p.loading ? <span style={{ color: "#94a3b8" }}>…</span> : (money ?? <span style={{ color: "#cbd5e1" }}>-</span>)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {editing ? (
                          <button onClick={() => setEditIdx(null)} title="เสร็จ" style={{ color: "#16a34a", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✓</button>
                        ) : (
                          <button onClick={() => removeAt(i)} title="ลบ" style={{ color: "#b91c1c", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700 }}>
                  <td colSpan={5} style={{ textAlign: "right" }}>รวม</td>
                  <td style={{ textAlign: "right", color: "#0369a1" }}>{fmtMoney(total) ?? "0.00"}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ข้อมูลใบประเมินราคา + บันทึก/พิมพ์ */}
      {picked.length > 0 && (
        <div className="form-card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>📄 ข้อมูลใบประเมินราคา</div>

          {/* ลูกค้า */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: "2 1 240px" }}>
              <label style={lbl}>ลูกค้า</label>
              <input value={q.customer_name} onChange={(e) => setQF("customer_name", e.target.value)} placeholder="ชื่อลูกค้า" style={selStyle} />
            </div>
            <button onClick={() => setShowCust(true)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1e3a8a", background: "#1e3a8a", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
              🔎 เลือกลูกค้า
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <input value={q.customer_phone} onChange={(e) => setQF("customer_phone", e.target.value)} placeholder="เบอร์โทร" style={{ ...selStyle, flex: "1 1 140px" }} />
            <input value={q.customer_tax_id} onChange={(e) => setQF("customer_tax_id", e.target.value)} placeholder="เลขผู้เสียภาษี" style={{ ...selStyle, flex: "1 1 160px" }} />
            <input value={q.customer_address} onChange={(e) => setQF("customer_address", e.target.value)} placeholder="ที่อยู่" style={{ ...selStyle, flex: "2 1 260px" }} />
          </div>

          {/* รถ */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <input value={q.plate_no} onChange={(e) => setQF("plate_no", e.target.value)} placeholder="ทะเบียนรถ" style={{ ...selStyle, flex: "1 1 130px" }} />
            <input value={q.model_year} onChange={(e) => setQF("model_year", e.target.value)} placeholder="รุ่นปี" style={{ ...selStyle, flex: "1 1 90px" }} />
            <input value={q.mileage} onChange={(e) => setQF("mileage", e.target.value)} placeholder="ระยะทางใช้งาน" style={{ ...selStyle, flex: "1 1 120px" }} />
            <input value={q.vin} onChange={(e) => setQF("vin", e.target.value)} placeholder="หมายเลขตัวถัง (VIN)" style={{ ...selStyle, flex: "1 1 180px" }} />
            <input value={q.engine_no} onChange={(e) => setQF("engine_no", e.target.value)} placeholder="หมายเลขเครื่อง" style={{ ...selStyle, flex: "1 1 160px" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>ปัญหา/อาการ/รายการที่สั่งซ่อม</label>
            <textarea value={q.problem} onChange={(e) => setQF("problem", e.target.value)} rows={2} style={{ ...selStyle, resize: "vertical" }} />
          </div>

          {/* เงิน */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: "1 1 120px" }}>
              <label style={lbl}>ค่าบริการ</label>
              <input type="number" min="0" value={q.labor} onChange={(e) => setQF("labor", e.target.value)} placeholder="0.00" style={selStyle} />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label style={lbl}>ส่วนลดค่าบริการ</label>
              <input type="number" min="0" value={q.labor_discount} onChange={(e) => setQF("labor_discount", e.target.value)} placeholder="0.00" style={selStyle} />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label style={lbl}>ส่วนลดค่าอะไหล่</label>
              <input type="number" min="0" value={q.parts_discount} onChange={(e) => setQF("parts_discount", e.target.value)} placeholder="0.00" style={selStyle} />
            </div>
          </div>

          {/* สรุปยอด */}
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 2 }}>
            <span>ค่าอะไหล่</span><span style={{ textAlign: "right" }}>{fmtMoney(partsNet)}</span>
            <span>ค่าบริการ</span><span style={{ textAlign: "right" }}>{fmtMoney(laborNet)}</span>
            <span>มูลค่าก่อนภาษี</span><span style={{ textAlign: "right" }}>{fmtMoney(subtotal)}</span>
            <span>ภาษีมูลค่าเพิ่ม 7%</span><span style={{ textAlign: "right" }}>{fmtMoney(vat)}</span>
            <span style={{ fontWeight: 700, color: "#0369a1" }}>รวมทั้งสิ้น</span><span style={{ textAlign: "right", fontWeight: 700, color: "#0369a1" }}>{fmtMoney(grand)}</span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={saveQuote} disabled={saving}>{saving ? "กำลังบันทึก..." : "💾 บันทึกใบประเมิน"}</button>
            <button onClick={() => printQuote(savedNo)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #0369a1", background: "#fff", color: "#0369a1", cursor: "pointer", fontWeight: 600 }}>🖨️ พิมพ์ใบประเมิน</button>
            <button onClick={sendLine} disabled={!savedNo} title={!savedNo ? "บันทึกก่อน" : (q.customer_line_user_id ? "" : "ลูกค้ายังไม่ผูก LINE")}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: savedNo ? "#06c755" : "#cbd5e1", color: "#fff", cursor: savedNo ? "pointer" : "not-allowed", fontWeight: 600 }}>
              📤 ส่งให้ลูกค้าทาง LINE
            </button>
            {savedNo && <span style={{ alignSelf: "center", fontSize: 13, color: "#15803d" }}>บันทึกแล้ว: {savedNo}</span>}
          </div>
        </div>
      )}

      {/* เลือกลูกค้า */}
      {showCust && (
        <CustomerPickerModal
          currentUser={currentUser}
          onClose={() => setShowCust(false)}
          onSelect={(c) => {
            setQ((p) => ({ ...p, customer_code: c.code || "", customer_name: c.name || "", customer_phone: c.phone || p.customer_phone, customer_address: c.address || c.province || p.customer_address, customer_tax_id: c.tax_id || p.customer_tax_id, customer_line_user_id: c.line_user_id || "" }));
            setShowCust(false);
          }}
        />
      )}

      {/* ประวัติใบประเมิน */}
      {showHist && (
        <div onClick={() => setShowHist(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 720, maxHeight: "85vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>📋 ประวัติใบประเมินราคา</div>
              <button onClick={() => setShowHist(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>×</button>
            </div>
            {hist == null ? <div style={{ color: "#64748b" }}>กำลังโหลด...</div> : hist.length === 0 ? <div style={{ color: "#64748b" }}>ยังไม่มีใบประเมิน</div> : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th>รุ่น/สี</th><th style={{ textAlign: "right" }}>รวม</th><th></th></tr></thead>
                  <tbody>
                    {hist.map((h) => (
                      <tr key={h.id}>
                        <td style={{ fontFamily: "monospace" }}>{h.quote_no}</td>
                        <td style={{ fontSize: 12 }}>{h.created_at ? new Date(h.created_at).toLocaleString("th-TH") : ""}</td>
                        <td>{h.customer_name || "-"}</td>
                        <td style={{ fontSize: 12 }}>{h.model} {h.color}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtMoney(h.grand_total)}</td>
                        <td style={{ textAlign: "center" }}><button onClick={() => reprint(h.quote_no)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #0369a1", background: "#fff", color: "#0369a1", cursor: "pointer", fontSize: 12 }}>🖨️ พิมพ์</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP เพิ่มรายการเอง */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>➕ เพิ่มรายการอะไหล่</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>×</button>
            </div>

            <label style={lbl}>รหัสอะไหล่</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={addCode}
                onChange={(e) => { setAddCode(e.target.value); setAddStatus("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && searchAdd()}
                placeholder="เช่น 42650-K1B-T00ZA"
                style={{ ...selStyle, flex: 1, fontFamily: "monospace" }}
                autoFocus
              />
              <button className="btn-primary" onClick={searchAdd} disabled={addStatus === "searching" || !addCode.trim()} style={{ whiteSpace: "nowrap" }}>
                {addStatus === "searching" ? "..." : "🔍 ค้นราคา"}
              </button>
            </div>

            {addStatus === "found" && <div style={{ fontSize: 12, color: "#15803d", marginBottom: 8 }}>✅ พบในตารางราคา (แก้ไขได้)</div>}
            {addStatus === "notfound" && <div style={{ fontSize: 12, color: "#b45309", marginBottom: 8 }}>⚠️ ไม่พบในตารางราคา — พิมพ์ชื่อ + ใส่ราคาเอง</div>}
            {addStatus === "dup" && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>❌ รหัสนี้มีในรายการแล้ว</div>}

            <label style={lbl}>ชื่ออะไหล่</label>
            <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="ชื่อสินค้า" style={{ ...selStyle, marginBottom: 10 }} />

            <label style={lbl}>ราคาขาย (บาท)</label>
            <input type="number" min="0" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} placeholder="0.00" style={{ ...selStyle, marginBottom: 16 }} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>ยกเลิก</button>
              <button className="btn-primary" onClick={confirmAdd} disabled={!addCode.trim()}>เพิ่มลงรายการ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
