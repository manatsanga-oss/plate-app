import React, { useMemo, useState } from "react";
import { AP_START, AP_COMPANIES, AP_COMPANY_FULL, AP_SOURCES, AP_BUCKETS, loadPayableDocs, payablesAsOf, groupPayables } from "../lib/accountsPayable";

// ===== เมนู Accounting → บัญชี → เจ้าหนี้ตามเอกสาร (user 2026-11-12) =====
// รายงานแบบเดียวกับ FlowAccount "รายงานเจ้าหนี้ตามเอกสาร": ณ วันที่ + วิเคราะห์อายุหนี้ + แยกผู้จำหน่าย กดขยายดูเอกสาร — เพิ่มตัวกรองสังกัด (ป.เปา / สิงห์ชัย)
// ตรรกะ/แหล่งข้อมูล/ข้อจำกัดทั้งหมดอยู่ใน src/lib/accountsPayable.js

const fmt = (n) => (Math.abs(Number(n) || 0) < 0.005 ? "-" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const thDate = (iso) => (iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${Number(iso.slice(0, 4)) + 543}` : "-");
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDateLong = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`; };
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const companyLabel = (c) => AP_COMPANY_FULL[c] || c || "ไม่ระบุสังกัด";

export default function AccountsPayablePage() {
  const [asOf, setAsOf] = useState(todayIso());
  const [basis, setBasis] = useState("due");           // due = ตามวันที่ครบกำหนด · doc = ตามวันที่เอกสาร
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [kw, setKw] = useState("");
  const [includeOld, setIncludeOld] = useState(false);
  const [includeEmployee, setIncludeEmployee] = useState(false);
  const [docs, setDocs] = useState(null);               // เอกสารดิบที่โหลดมา (null = ยังไม่ได้โหลด)
  const [loaded, setLoaded] = useState(null);           // { asOf, includeOld } ของชุดที่โหลด
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(() => new Set());    // "สังกัด|ผู้จำหน่าย" ที่ขยายอยู่

  async function load() {
    if (!asOf) return;
    setLoading(true); setErr(""); setProgress("");
    try {
      const list = await loadPayableDocs({ asOf, includeOld, onProgress: setProgress });
      setDocs(list); setLoaded({ asOf, includeOld }); setOpen(new Set());
    } catch (e) {
      setErr("โหลดข้อมูลไม่สำเร็จ: " + String(e?.message || e).slice(0, 160));
    }
    setLoading(false);
  }

  const needReload = loaded && (loaded.asOf !== asOf || loaded.includeOld !== includeOld);
  const rows = useMemo(() => {
    if (!docs || !loaded) return [];
    const k = kw.trim().toLowerCase();
    return payablesAsOf(docs, loaded.asOf, { company, source, includeOld: loaded.includeOld, includeEmployee, basis })
      .filter((d) => !k || d.vendor.toLowerCase().includes(k) || d.doc_no.toLowerCase().includes(k));
  }, [docs, loaded, company, source, includeEmployee, basis, kw]);
  const grouped = useMemo(() => groupPayables(rows), [rows]);
  const allKeys = useMemo(() => grouped.companies.flatMap((c) => c.vendors.map((v) => `${c.company}|${v.vendor}`)), [grouped]);
  const toggle = (key) => setOpen((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  async function exportExcel() {
    if (!rows.length || !loaded) return;
    const XLSX = await import("xlsx");
    const head = ["สังกัด", "ชื่อผู้จำหน่าย/เลขที่เอกสาร", "ประเภท", "วัน/เดือน/ปี", "ครบกำหนด", "รายละเอียด", "ยอดตามเอกสาร", "ยอดค้างจ่ายคงเหลือ", ...AP_BUCKETS.map((b) => b.label), "จ่ายเมื่อ", "เลขที่ใบจ่าย"];
    const aoa = [["รายงานเจ้าหนี้ตามเอกสาร"], ["สังกัด", company ? companyLabel(company) : "ทุกสังกัด"], ["ณ วันที่ :", thDate(loaded.asOf)], ["วิเคราะห์อายุ :", basis === "doc" ? "ตามวันที่เอกสาร" : "ตามวันที่ครบกำหนด"], [], head];
    const bucketCells = (o) => AP_BUCKETS.map((b) => o[b.key] || 0);
    for (const c of grouped.companies) {
      for (const v of c.vendors) {
        aoa.push([companyLabel(c.company), v.vendor]);
        for (const d of v.docs) aoa.push(["", d.doc_no, AP_SOURCES[d.source]?.label || d.source, thDate(d.doc_date), thDate(d.due_date), d.desc, d.amount, d.amount, ...AP_BUCKETS.map((b) => (d.bucket === b.key ? d.amount : 0)), d.paid_date ? thDate(d.paid_date) : "", d.paid_ref || ""]);
        aoa.push(["", "", "", "", "", "ยอดรวม", v.total.amount, v.total.amount, ...bucketCells(v.total)]);
        aoa.push([]);
      }
      if (grouped.companies.length > 1) { aoa.push(["", "", "", "", "", `รวม ${companyLabel(c.company)}`, c.total.amount, c.total.amount, ...bucketCells(c.total)]); aoa.push([]); }
    }
    aoa.push(["", "", "", "", "", "ยอดรวมทั้งหมด", grouped.total.amount, grouped.total.amount, ...bucketCells(grouped.total)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AccountPayables");
    XLSX.writeFile(wb, `เจ้าหนี้ตามเอกสาร_${company || "ทุกสังกัด"}_${loaded.asOf}.xlsx`);
  }

  const th = { padding: "8px 10px", fontSize: 12.5, fontWeight: 700, color: "#0369a1", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
  const td = { padding: "7px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", textAlign: "left" }; // ระบุชิดซ้ายเอง — CSS กลางของแอปจัดกลาง ทำให้ชื่อผู้จำหน่ายเยื้องไม่เท่ากัน
  const num = { ...td, textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };
  const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13 };
  const lbl = { fontSize: 12.5, fontWeight: 600, display: "grid", gap: 4 };
  const btn = (bg) => ({ padding: "8px 14px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13 });
  const bucketBg = ["#f0fdf4", "#f0f9ff", "#e0f2fe", "#dbeafe", "#eef2ff"];
  const sumCells = (o, bold) => (<>
    <td style={{ ...num, fontWeight: bold ? 700 : 400 }}>{fmt(o.amount)}</td>
    <td style={{ ...num, fontWeight: bold ? 700 : 400 }}>{fmt(o.amount)}</td>
    {AP_BUCKETS.map((b, i) => <td key={b.key} style={{ ...num, fontWeight: bold ? 700 : 400, background: bucketBg[i] }}>{fmt(o[b.key])}</td>)}
  </>);

  return (
    <div style={{ fontFamily: "Tahoma, sans-serif", padding: 20, background: "#f8fafc", minHeight: "100vh", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#0369a1" }}>📑 รายงานเจ้าหนี้ตามเอกสาร</h2>
        <span style={{ fontSize: 12.5, color: "#64748b" }}>เอกสารที่ยังไม่จ่าย หรือจ่ายหลังวันที่รายงาน — จากบันทึกค่าใช้จ่าย + ใบกำกับค่ารถ/ค่าอะไหล่ (บันทึกชำระค่าสินค้า)</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportExcel} disabled={!rows.length} style={{ ...btn("#0284c7"), opacity: rows.length ? 1 : 0.5 }}>⬇ ดาวน์โหลด Excel</button>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14 }}>
        <label style={lbl}>ณ วันที่
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={inp} /></label>
        <label style={lbl}>วิเคราะห์อายุ
          <select value={basis} onChange={(e) => setBasis(e.target.value)} style={inp}>
            <option value="due">ตามวันที่ครบกำหนด</option>
            <option value="doc">ตามวันที่เอกสาร</option>
          </select></label>
        <label style={lbl}>สังกัด
          <select value={company} onChange={(e) => setCompany(e.target.value)} style={{ ...inp, minWidth: 230 }}>
            <option value="">ทุกสังกัด</option>
            {AP_COMPANIES.map((c) => <option key={c} value={c}>{AP_COMPANY_FULL[c]}</option>)}
          </select></label>
        <label style={lbl}>ประเภทเอกสาร
          <select value={source} onChange={(e) => setSource(e.target.value)} style={inp}>
            <option value="">ทุกประเภท</option>
            {Object.entries(AP_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></label>
        <label style={lbl}>ชื่อผู้จำหน่าย / เลขที่เอกสาร
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="แสดงทั้งหมด" style={{ ...inp, minWidth: 200 }} /></label>
        <button onClick={load} disabled={loading || !asOf} style={{ ...btn(docs === null ? "#059669" : "#0ea5e9"), opacity: loading ? 0.6 : 1, boxShadow: docs === null && !loading ? "0 0 0 3px #a7f3d0" : "none" }}>{loading ? `กำลังโหลด… ${progress}` : "แสดงผลรายงาน"}</button>
        <div style={{ display: "grid", gap: 4, fontSize: 12.5 }}>
          <label style={{ cursor: "pointer" }} title={`เอกสารก่อน ${thDate(AP_START)} จ่ายจริงไปแล้วแต่ไม่มีใบจ่ายในระบบ (ระบบบันทึกจ่ายเริ่มใช้ ก.ย.69) — ติ๊กแล้วต้องกดแสดงผลรายงานใหม่`}>
            <input type="checkbox" checked={includeOld} onChange={(e) => setIncludeOld(e.target.checked)} /> รวมเอกสารก่อน {thDate(AP_START)}</label>
          <label style={{ cursor: "pointer" }} title="ใบค่าใช้จ่ายที่สร้างจากเงินเดือน/ค่าคอม (ประกันสังคม · สรรพากร · กยศ. ฯลฯ) — ไม่ใช่เจ้าหนี้การค้า งบทดลองมีบรรทัดแยกอยู่แล้ว">
            <input type="checkbox" checked={includeEmployee} onChange={(e) => setIncludeEmployee(e.target.checked)} /> รวมเจ้าหนี้เงินเดือน/ค่าคอม/เงินนำส่ง</label>
        </div>
      </div>
      {docs === null && !loading && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fffbeb", color: "#b45309", fontWeight: 600, fontSize: 13 }}>ยังไม่ได้ดึงข้อมูล — เลือกวันที่แล้วกด "แสดงผลรายงาน"</div>}
      {needReload && !loading && <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 8, background: "#fffbeb", color: "#b45309", fontSize: 12.5 }}>กำลังแสดงข้อมูล ณ วันที่ {thDate(loaded.asOf)} — กด "แสดงผลรายงาน" เพื่อโหลดตามตัวเลือกใหม่</div>}
      {err && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{err}</div>}

      {loaded && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0369a1" }}>{company ? companyLabel(company) : "ทุกสังกัด (ป.เปา + สิงห์ชัย)"}</div>
              <div style={{ fontSize: 12.5, color: "#475569" }}>สิ้นสุด ณ วันที่ {thDateLong(loaded.asOf)} · {grouped.total.count.toLocaleString()} เอกสาร · {allKeys.length} ผู้จำหน่าย</div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>ยอดค้างจ่าย</div>
              <div style={{ fontSize: 22, color: "#0284c7" }}>{fmt(grouped.total.amount)}</div>
            </div>
          </div>
          <div style={{ marginBottom: 8, fontSize: 12.5 }}>
            <button onClick={() => setOpen(new Set(allKeys))} style={{ ...btn("#fff"), color: "#0369a1", border: "1px solid #bae6fd", padding: "4px 10px", fontWeight: 600 }}>ขยายทั้งหมด</button>{" "}
            <button onClick={() => setOpen(new Set())} style={{ ...btn("#fff"), color: "#0369a1", border: "1px solid #bae6fd", padding: "4px 10px", fontWeight: 600 }}>ย่อทั้งหมด</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>ชื่อผู้จำหน่าย / เลขที่เอกสาร</th>
                  <th style={{ ...th, textAlign: "left" }}>วันที่เอกสาร</th>
                  <th style={{ ...th, textAlign: "left" }}>วันครบกำหนด</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดตามเอกสาร</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดค้างจ่ายคงเหลือ</th>
                  {AP_BUCKETS.map((b, i) => <th key={b.key} style={{ ...th, textAlign: "right", background: bucketBg[i], color: i === 0 ? "#15803d" : "#0369a1" }}>{b.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {!rows.length && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 28 }}>ไม่มีเอกสารค้างจ่าย ณ วันที่นี้ตามตัวกรองที่เลือก</td></tr>}
                {grouped.companies.map((c) => (
                  <React.Fragment key={c.company || "-"}>
                    {(grouped.companies.length > 1 || !company) && (
                      <tr><td colSpan={10} style={{ ...td, background: "#e0f2fe", fontWeight: 700, color: "#075985" }}>▾ {companyLabel(c.company)} · {c.vendors.length} ผู้จำหน่าย · {c.total.count.toLocaleString()} เอกสาร</td></tr>
                    )}
                    {c.vendors.map((v) => {
                      const key = `${c.company}|${v.vendor}`; const isOpen = open.has(key);
                      return (
                        <React.Fragment key={key}>
                          <tr onClick={() => toggle(key)} style={{ cursor: "pointer" }}>
                            <td style={{ ...td, fontWeight: 700 }}>{isOpen ? "⌄" : "›"} {v.vendor} <span style={{ marginLeft: 4, padding: "1px 7px", borderRadius: 10, background: "#e2e8f0", fontSize: 11.5, fontWeight: 600 }}>{v.total.count}</span></td>
                            <td style={td} /><td style={td} />
                            {sumCells(v.total, true)}
                          </tr>
                          {isOpen && v.docs.map((d) => (
                            <tr key={d.key} style={{ background: "#fcfdff" }}>
                              <td style={{ ...td, paddingLeft: 30 }}>
                                <span style={{ fontFamily: "monospace" }}>{d.doc_no}</span>
                                <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 11, background: d.source === "expense" ? "#fef3c7" : d.source === "vehicle" ? "#dcfce7" : "#e0e7ff", color: "#334155" }}>{AP_SOURCES[d.source]?.label || d.source}</span>
                                {d.employee && <span style={{ marginLeft: 4, padding: "1px 6px", borderRadius: 4, fontSize: 11, background: "#fee2e2", color: "#991b1b" }}>เงินเดือน/ค่าคอม</span>}
                                <div style={{ fontSize: 11.5, color: "#64748b" }}>
                                  {d.desc}{d.ref ? ` · อ้างอิง ${d.ref}` : ""}
                                  {d.paid_date ? <span style={{ color: "#b45309" }}> · จ่ายเมื่อ {thDate(d.paid_date)}{d.paid_ref ? ` (${d.paid_ref})` : ""}</span> : <span style={{ color: "#dc2626" }}> · ยังไม่ได้บันทึกจ่าย</span>}
                                </div>
                              </td>
                              <td style={{ ...td, whiteSpace: "nowrap" }}>{thDate(d.doc_date)}</td>
                              <td style={{ ...td, whiteSpace: "nowrap" }}>{thDate(d.due_date)}{d.overdue_days > 0 && <div style={{ fontSize: 11, color: "#dc2626" }}>เกิน {d.overdue_days} วัน</div>}</td>
                              <td style={num}>{fmt(d.amount)}</td>
                              <td style={num}>{fmt(d.amount)}</td>
                              {AP_BUCKETS.map((b, i) => <td key={b.key} style={{ ...num, background: bucketBg[i] }}>{d.bucket === b.key ? fmt(d.amount) : "-"}</td>)}
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
            <b>หมายเหตุ</b> · เจ้าหนี้ ณ วันที่ = เอกสารลงวันที่ไม่เกินวันที่รายงาน ที่ยังไม่ได้บันทึกจ่าย หรือบันทึกจ่ายหลังวันที่รายงาน (ดูย้อนหลังได้)
            · แหล่งข้อมูล: บันทึกค่าใช้จ่าย · ใบกำกับค่ารถ · ใบกำกับค่าอะไหล่/สินค้า (สถานะจ่ายจากเมนูบันทึกชำระค่าสินค้า)
            · วันครบกำหนด: ค่าใช้จ่าย/ค่ารถ = วันที่เอกสาร · ค่าอะไหล่/สินค้า = วันที่เอกสาร + 30 วัน · อะไหล่จากไทยฮอนด้า = วันที่ 15 ของเดือนถัดไป (ระบบยังไม่ได้เก็บเครดิตเทอมรายผู้จำหน่าย)
            · สังกัดของค่ารถ/อะไหล่: ตามบัญชีธนาคารที่จ่าย ถ้ายังไม่จ่ายถือตามยี่ห้อ (HONDA = ป.เปา · YAMAHA = สิงห์ชัย)
            · <b>ยังไม่รวม</b>: งานวางบิล (ทะเบียน · พรบ. · ประกัน COSMOS · งานรับเรื่อง) · ค่าใช้จ่ายจาก FLOW ACC · รับวัสดุสำนักงาน · ซื้อขายระหว่างบริษัท
          </div>
        </div>
      )}
    </div>
  );
}
