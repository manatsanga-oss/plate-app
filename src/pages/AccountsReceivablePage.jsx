import React, { useMemo, useState } from "react";
import { AR_START, AR_INCOME_START, AR_COMPANIES, AR_COMPANY_FULL, AR_SOURCES, AR_BUCKETS, loadReceivableDocs, receivablesAsOf, groupReceivables } from "../lib/accountsReceivable";

// ===== เมนู Accounting → บัญชี → ลูกหนี้ตามเอกสาร (user 2026-11-13) =====
// รายงานแบบเดียวกับ FlowAccount "รายงานลูกหนี้ตามเอกสาร": ณ วันที่ + วิเคราะห์อายุหนี้ + แยกลูกค้า กดขยายดูเอกสาร — เพิ่มตัวกรองสังกัด (ป.เปา / สิงห์ชัย)
// หน้าคู่กับ AccountsPayablePage (เจ้าหนี้ตามเอกสาร) · ตรรกะ/แหล่งข้อมูล/ข้อจำกัดทั้งหมดอยู่ใน src/lib/accountsReceivable.js

const fmt = (n) => (Math.abs(Number(n) || 0) < 0.005 ? "-" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const thDate = (iso) => (iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${Number(iso.slice(0, 4)) + 543}` : "-");
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDateLong = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`; };
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const companyLabel = (c) => AR_COMPANY_FULL[c] || c || "ไม่ระบุสังกัด";

export default function AccountsReceivablePage() {
  const [asOf, setAsOf] = useState(todayIso());
  const [basis, setBasis] = useState("due");           // due = ตามวันที่ครบกำหนด · doc = ตามวันที่เอกสาร (ตอนนี้วันครบกำหนด = วันที่เอกสาร)
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [kw, setKw] = useState("");
  const [includeShort, setIncludeShort] = useState(false);
  const [includeOld, setIncludeOld] = useState(false);  // รวมใบรายได้อื่นก่อน AR_INCOME_START (ถือว่ารับครบแล้ว — user 2026-11-13)
  const [docs, setDocs] = useState(null);               // เอกสารดิบที่โหลดมา (null = ยังไม่ได้โหลด)
  const [info, setInfo] = useState(null);
  const [loadedAsOf, setLoadedAsOf] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(() => new Set());    // "สังกัด|ลูกค้า" ที่ขยายอยู่

  async function load() {
    if (!asOf) return;
    setLoading(true); setErr(""); setProgress("");
    try {
      const res = await loadReceivableDocs({ asOf, onProgress: setProgress });
      setDocs(res.docs); setInfo(res.info); setLoadedAsOf(asOf); setOpen(new Set());
    } catch (e) {
      setErr("โหลดข้อมูลไม่สำเร็จ: " + String(e?.message || e).slice(0, 160));
    }
    setLoading(false);
  }

  const needReload = loadedAsOf && loadedAsOf !== asOf;
  const rows = useMemo(() => {
    if (!docs || !loadedAsOf) return [];
    const k = kw.trim().toLowerCase();
    return receivablesAsOf(docs, loadedAsOf, { company, source, includeShort, includeOld, basis })
      .filter((d) => !k || d.customer.toLowerCase().includes(k) || d.doc_no.toLowerCase().includes(k) || d.desc.toLowerCase().includes(k));
  }, [docs, loadedAsOf, company, source, includeShort, includeOld, basis, kw]);
  const grouped = useMemo(() => groupReceivables(rows), [rows]);
  const allKeys = useMemo(() => grouped.companies.flatMap((c) => c.customers.map((v) => `${c.company}|${v.customer}`)), [grouped]);
  const toggle = (key) => setOpen((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  async function exportExcel() {
    if (!rows.length || !loadedAsOf) return;
    const XLSX = await import("xlsx");
    const head = ["สังกัด", "ชื่อลูกค้า/เลขที่เอกสาร", "ประเภท", "วัน/เดือน/ปี", "ครบกำหนด", "รายละเอียด", "ยอดตามเอกสาร", "เก็บเงินแล้ว", "ยอดค้างรับคงเหลือ", ...AR_BUCKETS.map((b) => b.label), "รับเงินเมื่อ", "อ้างอิงการรับเงิน"];
    const aoa = [["รายงานลูกหนี้ตามเอกสาร"], ["สังกัด", company ? companyLabel(company) : "ทุกสังกัด"], ["ณ วันที่ :", thDate(loadedAsOf)], ["วิเคราะห์อายุ :", basis === "doc" ? "ตามวันที่เอกสาร" : "ตามวันที่ครบกำหนด"], [], head];
    const sums = (o) => [o.doc_total, o.collected, o.amount, ...AR_BUCKETS.map((b) => o[b.key] || 0)];
    for (const c of grouped.companies) {
      for (const v of c.customers) {
        aoa.push([companyLabel(c.company), v.customer]);
        for (const d of v.docs) aoa.push(["", d.doc_no, AR_SOURCES[d.source]?.label || d.source, thDate(d.doc_date), thDate(d.due_date), [d.desc, d.note].filter(Boolean).join(" · "), d.doc_total, d.collected, d.amount, ...AR_BUCKETS.map((b) => (d.bucket === b.key ? d.amount : 0)), d.paid_date ? thDate(d.paid_date) : "", d.paid_ref || ""]);
        aoa.push(["", "", "", "", "", "ยอดรวม", ...sums(v.total)]);
        aoa.push([]);
      }
      if (grouped.companies.length > 1) { aoa.push(["", "", "", "", "", `รวม ${companyLabel(c.company)}`, ...sums(c.total)]); aoa.push([]); }
    }
    aoa.push(["", "", "", "", "", "ยอดรวมทั้งหมด", ...sums(grouped.total)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AccountReceivables");
    XLSX.writeFile(wb, `ลูกหนี้ตามเอกสาร_${company || "ทุกสังกัด"}_${loadedAsOf}.xlsx`);
  }

  const th = { padding: "8px 10px", fontSize: 12.5, fontWeight: 700, color: "#0369a1", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
  const td = { padding: "7px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", textAlign: "left" }; // ระบุชิดซ้ายเอง — CSS กลางของแอปจัดกลาง
  const num = { ...td, textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };
  const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13 };
  const lbl = { fontSize: 12.5, fontWeight: 600, display: "grid", gap: 4 };
  const btn = (bg) => ({ padding: "8px 14px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13 });
  const bucketBg = ["#f0fdf4", "#f0f9ff", "#e0f2fe", "#dbeafe", "#eef2ff"];
  const COLS = 11;
  const sumCells = (o, bold) => (<>
    <td style={{ ...num, fontWeight: bold ? 700 : 400 }}>{fmt(o.doc_total)}</td>
    <td style={{ ...num, fontWeight: bold ? 700 : 400 }}>{fmt(o.collected)}</td>
    <td style={{ ...num, fontWeight: bold ? 700 : 400 }}>{fmt(o.amount)}</td>
    {AR_BUCKETS.map((b, i) => <td key={b.key} style={{ ...num, fontWeight: bold ? 700 : 400, background: bucketBg[i] }}>{fmt(o[b.key])}</td>)}
  </>);

  return (
    <div style={{ fontFamily: "Tahoma, sans-serif", padding: 20, background: "#f8fafc", minHeight: "100vh", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#0369a1" }}>📑 รายงานลูกหนี้ตามเอกสาร</h2>
        <span style={{ fontSize: 12.5, color: "#64748b" }}>เอกสารที่ยังไม่ได้รับเงิน หรือรับเงินหลังวันที่รายงาน — ลูกหนี้ไฟแนนซ์จากใบกำกับขายรถ + รายได้อื่น</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportExcel} disabled={!rows.length} style={{ ...btn("#0284c7"), opacity: rows.length ? 1 : 0.5 }}>⬇ ดาวน์โหลด Excel</button>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14 }}>
        <label style={lbl}>ณ วันที่
          <input type="date" value={asOf} min={AR_START} onChange={(e) => setAsOf(e.target.value)} style={inp} /></label>
        <label style={lbl}>วิเคราะห์อายุ
          <select value={basis} onChange={(e) => setBasis(e.target.value)} style={inp}>
            <option value="due">ตามวันที่ครบกำหนด</option>
            <option value="doc">ตามวันที่เอกสาร</option>
          </select></label>
        <label style={lbl}>สังกัด
          <select value={company} onChange={(e) => setCompany(e.target.value)} style={{ ...inp, minWidth: 230 }}>
            <option value="">ทุกสังกัด</option>
            {AR_COMPANIES.map((c) => <option key={c} value={c}>{AR_COMPANY_FULL[c]}</option>)}
          </select></label>
        <label style={lbl}>ประเภทเอกสาร
          <select value={source} onChange={(e) => setSource(e.target.value)} style={inp}>
            <option value="">ทุกประเภท</option>
            {Object.entries(AR_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></label>
        <label style={lbl}>ชื่อลูกค้า / เลขที่เอกสาร
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="แสดงทั้งหมด" style={{ ...inp, minWidth: 200 }} /></label>
        <button onClick={load} disabled={loading || !asOf} style={{ ...btn(docs === null ? "#059669" : "#0ea5e9"), opacity: loading ? 0.6 : 1, boxShadow: docs === null && !loading ? "0 0 0 3px #a7f3d0" : "none" }}>{loading ? `กำลังโหลด… ${progress}` : "แสดงผลรายงาน"}</button>
        <div style={{ display: "grid", gap: 4, fontSize: 12.5 }}>
          <label style={{ cursor: "pointer" }} title="คันที่ไฟแนนซ์โอนเงินมาแล้วแต่น้อยกว่ายอดจัด (หักค่าธรรมเนียม/ดอกเบี้ย ฯลฯ) — ปกติไม่นับเป็นลูกหนี้ ติ๊กเพื่อดูส่วนต่างที่เหลือ">
            <input type="checkbox" checked={includeShort} onChange={(e) => setIncludeShort(e.target.checked)} /> แสดงยอดที่ไฟแนนซ์โอนขาด</label>
          <label style={{ cursor: "pointer" }} title={`ใบรายได้อื่นลงวันที่ก่อน ${thDate(AR_INCOME_START)} ถือว่ารับเงินครบแล้ว (ค้างในระบบเพราะยังไม่ได้บันทึกรับเงิน) — ติ๊กเพื่อดู`}>
            <input type="checkbox" checked={includeOld} onChange={(e) => setIncludeOld(e.target.checked)} /> รวมใบรายได้อื่นก่อน {thDate(AR_INCOME_START)}</label>
        </div>
      </div>
      {docs === null && !loading && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fffbeb", color: "#b45309", fontWeight: 600, fontSize: 13 }}>ยังไม่ได้ดึงข้อมูล — เลือกวันที่แล้วกด "แสดงผลรายงาน" (ใช้เวลาประมาณ 20–30 วินาที)</div>}
      {needReload && !loading && <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 8, background: "#fffbeb", color: "#b45309", fontSize: 12.5 }}>กำลังแสดงข้อมูล ณ วันที่ {thDate(loadedAsOf)} — กด "แสดงผลรายงาน" เพื่อโหลดตามวันที่ใหม่</div>}
      {err && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{err}</div>}

      {loadedAsOf && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0369a1" }}>{company ? companyLabel(company) : "ทุกสังกัด (ป.เปา + สิงห์ชัย)"}</div>
              <div style={{ fontSize: 12.5, color: "#475569" }}>สิ้นสุด ณ วันที่ {thDateLong(loadedAsOf)} · {grouped.total.count.toLocaleString()} เอกสาร · {allKeys.length} ลูกค้า</div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>ยอดค้างรับ</div>
              <div style={{ fontSize: 22, color: "#0284c7" }}>{fmt(grouped.total.amount)}</div>
            </div>
          </div>
          <div style={{ marginBottom: 8, fontSize: 12.5 }}>
            <button onClick={() => setOpen(new Set(allKeys))} style={{ ...btn("#fff"), color: "#0369a1", border: "1px solid #bae6fd", padding: "4px 10px", fontWeight: 600 }}>ขยายทั้งหมด</button>{" "}
            <button onClick={() => setOpen(new Set())} style={{ ...btn("#fff"), color: "#0369a1", border: "1px solid #bae6fd", padding: "4px 10px", fontWeight: 600 }}>ย่อทั้งหมด</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1280 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>ชื่อลูกค้า / เลขที่เอกสาร</th>
                  <th style={{ ...th, textAlign: "left" }}>วันที่เอกสาร</th>
                  <th style={{ ...th, textAlign: "left" }}>วันครบกำหนด</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดตามเอกสาร</th>
                  <th style={{ ...th, textAlign: "right" }}>เก็บเงินแล้ว</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดค้างรับคงเหลือ</th>
                  {AR_BUCKETS.map((b, i) => <th key={b.key} style={{ ...th, textAlign: "right", background: bucketBg[i], color: i === 0 ? "#15803d" : "#0369a1" }}>{b.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {!rows.length && <tr><td colSpan={COLS} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 28 }}>ไม่มีเอกสารค้างรับ ณ วันที่นี้ตามตัวกรองที่เลือก</td></tr>}
                {grouped.companies.map((c) => (
                  <React.Fragment key={c.company || "-"}>
                    {(grouped.companies.length > 1 || !company) && (
                      <tr><td colSpan={COLS} style={{ ...td, background: "#e0f2fe", fontWeight: 700, color: "#075985" }}>▾ {companyLabel(c.company)} · {c.customers.length} ลูกค้า · {c.total.count.toLocaleString()} เอกสาร</td></tr>
                    )}
                    {c.customers.map((v) => {
                      const key = `${c.company}|${v.customer}`; const isOpen = open.has(key);
                      return (
                        <React.Fragment key={key}>
                          <tr onClick={() => toggle(key)} style={{ cursor: "pointer" }}>
                            <td style={{ ...td, fontWeight: 700 }}>{isOpen ? "⌄" : "›"} {v.customer} <span style={{ marginLeft: 4, padding: "1px 7px", borderRadius: 10, background: "#e2e8f0", fontSize: 11.5, fontWeight: 600 }}>{v.total.count}</span></td>
                            <td style={td} /><td style={td} />
                            {sumCells(v.total, true)}
                          </tr>
                          {isOpen && v.docs.map((d) => (
                            <tr key={d.key} style={{ background: "#fcfdff" }}>
                              <td style={{ ...td, paddingLeft: 30 }}>
                                <span style={{ fontFamily: "monospace" }}>{d.doc_no}</span>
                                <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 11, background: d.source === "finance" ? "#dcfce7" : "#fef3c7", color: "#334155" }}>{AR_SOURCES[d.source]?.label || d.source}</span>
                                {d.short && <span style={{ marginLeft: 4, padding: "1px 6px", borderRadius: 4, fontSize: 11, background: "#fee2e2", color: "#991b1b" }}>โอนขาด</span>}
                                <div style={{ fontSize: 11.5, color: "#64748b", whiteSpace: "normal", maxWidth: 520 }}>
                                  {[d.desc, d.note].filter(Boolean).join(" · ")}
                                  {d.short ? <span style={{ color: "#b45309" }}> · รับแล้ว {fmt(d.paid_as_of)}{d.paid_ref ? ` (${d.paid_ref})` : ""}</span>
                                    : d.paid_date ? <span style={{ color: "#b45309" }}> · รับเงินเมื่อ {thDate(d.paid_date)}{d.paid_ref ? ` (${d.paid_ref})` : ""}</span>
                                    : <span style={{ color: "#dc2626" }}> · ยังไม่ได้รับเงิน</span>}
                                </div>
                              </td>
                              <td style={{ ...td, whiteSpace: "nowrap" }}>{thDate(d.doc_date)}</td>
                              <td style={{ ...td, whiteSpace: "nowrap" }}>{thDate(d.due_date)}{d.overdue_days > 0 && <div style={{ fontSize: 11, color: "#dc2626" }}>เกิน {d.overdue_days} วัน</div>}</td>
                              <td style={num}>{fmt(d.doc_total)}</td>
                              <td style={num}>{fmt(d.collected)}</td>
                              <td style={num}>{fmt(d.amount)}</td>
                              {AR_BUCKETS.map((b, i) => <td key={b.key} style={{ ...num, background: bucketBg[i] }}>{d.bucket === b.key ? fmt(d.amount) : "-"}</td>)}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {grouped.companies.length > 1 && (
                      <tr style={{ background: "#f1f5f9" }}>
                        <td colSpan={3} style={{ ...td, fontWeight: 700, textAlign: "right" }}>รวม {companyLabel(c.company)}</td>
                        {sumCells(c.total, true)}
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {rows.length > 0 && (
                  <tr style={{ background: "#e2e8f0" }}>
                    <td colSpan={3} style={{ ...td, fontWeight: 700 }}>ยอดรวมสุทธิ</td>
                    {sumCells(grouped.total, true)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, padding: "10px 2px 6px" }}>
            <b>หมายเหตุ</b> · ลูกหนี้ ณ วันที่ = เอกสารลงวันที่ไม่เกินวันที่รายงาน ที่ยังไม่ได้รับเงิน หรือรับเงินหลังวันที่รายงาน (ดูย้อนหลังได้)
            · <b>ขายรถ (ไฟแนนซ์)</b>: ตั้งตามใบกำกับภาษีขายรถ (วันที่ใบกำกับ) ตั้งแต่ {thDate(AR_START)} · ยอดค้างรับ = ยอดจัดไฟแนนซ์ − ประกันรถหายที่ไฟแนนซ์หัก · รับเงิน = รายการตัดรับเงินโอนไฟแนนท์ (ตามวันที่โอน)
            · ยอดตามเอกสาร = ยอดใบกำกับทั้งคัน · เก็บเงินแล้ว = ยอดใบกำกับ − ยอดค้างรับ (เงินดาวน์/ส่วนที่ลูกค้าจ่ายเอง)
            · คันที่ไฟแนนซ์โอนมาแล้วถือว่ารับครบ ส่วนที่โอนขาด (ค่าธรรมเนียม ฯลฯ) ดูได้จากช่องติ๊ก
            · <b>รายได้อื่น</b>: ใบบันทึกรายได้อื่น ๆ ที่ยังไม่รับเงิน (ยอดรวม VAT ก่อนหัก ณ ที่จ่าย) ตั้งแต่ {thDate(AR_INCOME_START)} — ใบก่อนหน้านั้นถือว่ารับครบแล้ว
            · สังกัด: ขายรถ = บริษัทที่ออกใบกำกับ · รายได้อื่น = สังกัดของใบ
            · <b>ยังไม่รวม</b>: ขายอะไหล่/บริการเงินเชื่อ · ขายส่งอะไหล่ · ขายระหว่างบริษัท
            {info && info.financeNoSale > 0 ? ` · ⚠️ มีใบกำกับจัดไฟแนนซ์ ${info.financeNoSale} ใบที่หาใบขายในระบบไม่เจอ (ไม่ทราบยอดจัด) จึงไม่ได้นับ` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
