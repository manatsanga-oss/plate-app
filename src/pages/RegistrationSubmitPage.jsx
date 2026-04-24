import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function RegistrationSubmitPage({ currentUser }) {
  const [brand, setBrand] = useState("ฮอนด้า");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [runNumber, setRunNumber] = useState("");
  const [submitDate, setSubmitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [province, setProvince] = useState("อยุธยา");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterFinance, setFilterFinance] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchPending(b = brand) {
    setLoading(true);
    try {
      const data = await post({ action: "get_pending_sales", brand: b });
      setRows(Array.isArray(data) ? data : []);
      setSelected({});
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  async function fetchNextRun() {
    try {
      const data = await post({ action: "get_next_run_number" });
      const row = Array.isArray(data) ? data[0] : data;
      // Support both new format (next_code: "TB-6904-001") and old format (next_run: 1)
      const code = row?.next_code || (row?.next_run ? `#${row.next_run}` : "");
      setRunNumber(code);
    } catch {}
  }

  useEffect(() => { fetchPending(); fetchNextRun(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchPending(brand); /* eslint-disable-next-line */ }, [brand]);

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
  const selectedRows = rows.filter(r => selected[r.sale_id]);

  // Filter rows — search only in engine_no and chassis_no (VIN)
  const kw = search.trim().toLowerCase();
  const filteredRows = rows.filter(r => {
    if (!kw) return true;
    const engine = String(r.engine_no || "").toLowerCase();
    const chassis = String(r.chassis_no || "").toLowerCase();
    return engine.includes(kw) || chassis.includes(kw);
  });

  const modelOpts = [...new Set(rows.map(r => r.model_series).filter(Boolean))].sort();
  const financeOpts = [...new Set(rows.map(r => r.finance_company).filter(Boolean))].sort();

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleAll() {
    const allFilteredIds = filteredRows.map(r => r.sale_id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected[id]);
    if (allSelected) {
      const next = { ...selected };
      allFilteredIds.forEach(id => { delete next[id]; });
      setSelected(next);
    } else {
      const next = { ...selected };
      allFilteredIds.forEach(id => { next[id] = true; });
      setSelected(next);
    }
  }

  function clearFilters() {
    setSearch(""); setDateFrom(""); setDateTo(""); setFilterModel(""); setFilterFinance(""); setPage(1);
  }

  function toggleOne(id) {
    setSelected(p => ({ ...p, [id]: !p[id] }));
  }

  function handlePrint() {
    if (selectedRows.length === 0) { setMessage("เลือกรายการก่อนพิมพ์"); return; }
    const html = buildPrintHTML({ runNumber, brand, submitDate, province, rows: selectedRows });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("เปิด popup ไม่ได้ (ตรวจ browser pop-up blocker)"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  }

  async function handleSubmit() {
    if (selectedRows.length === 0) { setMessage("เลือกรายการก่อนบันทึก"); return; }
    if (!window.confirm(`บันทึกส่งจดทะเบียน ${selectedRows.length} รายการ (เลขรัน ${runNumber})?`)) return;
    setSaving(true);
    setMessage("");
    try {
      // Derive year_month from submitDate (Buddhist YY + MM)
      const dt = new Date(submitDate);
      const ym = String((dt.getFullYear() + 543) % 100).padStart(2, "0") + String(dt.getMonth() + 1).padStart(2, "0");
      const res = await post({
        action: "submit_registrations",
        sale_ids: selectedIds,
        brand,
        province,
        submit_date: submitDate,
        year_month: ym,
        submitted_by: currentUser?.name || currentUser?.user_id || "",
      });
      const n = res?.inserted ?? (Array.isArray(res?.rows) ? res.rows.length : 0);
      const savedCode = res?.rows?.[0]?.run_code || runNumber;
      setMessage(`✅ บันทึกสำเร็จ ${n} รายการ (เลขรัน ${savedCode})`);
      await fetchPending(brand);
      await fetchNextRun();
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📝 ส่งงานทะเบียน</h2>
      </div>

      {/* Brand tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["ฮอนด้า", "ยามาฮ่า"].map(b => (
          <button key={b} onClick={() => setBrand(b)}
            style={{ padding: "10px 24px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15, fontWeight: 600,
              background: brand === b ? "#072d6b" : "#e5e7eb",
              color: brand === b ? "#fff" : "#374151" }}>
            {b}
          </button>
        ))}
      </div>

      {/* Control panel */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16, padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>เลขรัน:</label>
        <input type="text" value={runNumber} onChange={e => setRunNumber(e.target.value)}
          readOnly
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 14, width: 140, background: "#f9fafb", fontWeight: 600 }} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>วันที่ส่ง:</label>
        <input type="date" value={submitDate} onChange={e => setSubmitDate(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>จังหวัด:</label>
        <input type="text" value={province} onChange={e => setProvince(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, width: 120 }} />

        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
          เลือก <strong style={{ color: "#072d6b" }}>{selectedIds.length}</strong> / {filteredRows.length} รายการ
        </span>

        <button onClick={handlePrint} disabled={!selectedIds.length}
          style={{ padding: "8px 18px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: selectedIds.length ? "pointer" : "not-allowed", opacity: selectedIds.length ? 1 : 0.5, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
          🖨️ พิมพ์รายงาน
        </button>
        <button onClick={handleSubmit} disabled={!selectedIds.length || saving}
          style={{ padding: "8px 18px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (!selectedIds.length || saving) ? "not-allowed" : "pointer", opacity: (!selectedIds.length || saving) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
          💾 {saving ? "กำลังบันทึก..." : "บันทึกส่งแล้ว"}
        </button>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Search */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 ค้นหาจาก เลขเครื่อง หรือ เลขถัง (VIN)"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />
        {search && (
          <button onClick={() => { setSearch(""); setPage(1); }}
            style={{ padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            ✕ ล้าง
          </button>
        )}
        <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
          {filteredRows.length !== rows.length ? `พบ ${filteredRows.length}/${rows.length}` : `${rows.length} รายการ`}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่มีรายการรอส่งจดทะเบียนสำหรับยี่ห้อ {brand}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={selectedIds.length === rows.length && rows.length > 0} onChange={toggleAll} />
                </th>
                <th style={{ width: 40 }}>#</th>
                <th>เลขที่ใบขาย</th>
                <th>วันที่ขาย</th>
                <th>ชื่อลูกค้า</th>
                <th>ไฟแนนซ์</th>
                <th>รุ่น</th>
                <th>สี</th>
                <th>เลขเครื่อง</th>
                <th>เลขถัง (VIN)</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.sale_id} style={{ background: selected[r.sale_id] ? "#eff6ff" : undefined, cursor: "pointer" }}
                  onClick={() => toggleOne(r.sale_id)}>
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={!!selected[r.sale_id]} onChange={() => toggleOne(r.sale_id)} />
                  </td>
                  <td style={{ textAlign: "center" }}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.invoice_no || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.sale_date)}</td>
                  <td>{r.customer_name || "-"}</td>
                  <td>{r.finance_company || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.model_series || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.color_name || "-"}</td>
                  <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 13 }}>{r.engine_no || "-"}</td>
                  <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 13 }}>{r.chassis_no || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "14px 0" }}>
              <button onClick={() => setPage(1)} disabled={page === 1}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === 1 ? "#f3f4f6" : "#fff", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>{"<<"}</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === 1 ? "#f3f4f6" : "#fff", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>{"<"}</button>
              <span style={{ fontSize: 13, color: "#374151", padding: "0 10px" }}>หน้า {page} / {totalPages} ({filteredRows.length} รายการ)</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === totalPages ? "#f3f4f6" : "#fff", cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>{">"}</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === totalPages ? "#f3f4f6" : "#fff", cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>{">>"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, "0");
    const mo = String(dt.getMonth() + 1).padStart(2, "0");
    const yr = dt.getFullYear() + 543;
    return `${day}/${mo}/${String(yr).slice(-2)}`;
  } catch { return String(d); }
}

function buildPrintHTML({ runNumber, brand, submitDate, province, rows }) {
  const dt = new Date(submitDate);
  const dstr = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear() + 543}`;
  const tr = rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${safe(r.invoice_no)}</td>
      <td>${safe(r.customer_name)}</td>
      <td>${safe(r.finance_company)}</td>
      <td>${safe(r.model_series)}</td>
      <td>${safe(r.color_name)}</td>
      <td class="mono">${safe(r.engine_no)}</td>
      <td class="mono">${safe(r.chassis_no)}</td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบส่งงานทะเบียน เลขรัน ${runNumber}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Sarabun", "TH Sarabun New", "Tahoma", sans-serif; color: #111; margin: 0; font-size: 13px; }
  .doc { max-width: 210mm; margin: 0 auto; }
  .header { text-align: center; padding-bottom: 10px; border-bottom: 3px double #1e3a8a; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 700; margin: 0; color: #1e3a8a; letter-spacing: 0.5px; }
  .header .sub { font-size: 13px; color: #6b7280; margin-top: 2px; }
  .badge-brand { display: inline-block; padding: 3px 12px; border-radius: 999px; background: ${brand === "ฮอนด้า" ? "#fee2e2" : "#dbeafe"}; color: ${brand === "ฮอนด้า" ? "#991b1b" : "#1e40af"}; font-weight: 600; font-size: 12px; margin-left: 6px; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .meta-cell { background: #f8fafc; border-left: 3px solid #1e3a8a; padding: 8px 12px; border-radius: 4px; }
  .meta-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-size: 16px; font-weight: 700; color: #111827; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #1e3a8a; color: #fff; padding: 8px 6px; text-align: center; font-weight: 600; border: 1px solid #1e3a8a; }
  tbody td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .c { text-align: center; }
  .mono { font-family: "Consolas", monospace; font-size: 11px; white-space: nowrap; }
  .footer { margin-top: 30px; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
  .sign-box { text-align: center; }
  .sign-line { border-top: 1px dotted #111; padding-top: 6px; font-weight: 600; }
  .sign-sub { color: #6b7280; font-size: 11px; margin-top: 4px; }
  .note { margin-top: 18px; font-size: 11px; color: #6b7280; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
  @media print { .noprint { display: none; } }
</style></head><body>
<div class="doc">
  <div class="header">
    <h1>ใบส่งงานทะเบียนรถจักรยานยนต์<span class="badge-brand">${safe(brand)}</span></h1>
    <div class="sub">Motorcycle Registration Submission</div>
  </div>

  <div class="meta-grid">
    <div class="meta-cell"><div class="meta-label">เลขรัน (Run No.)</div><div class="meta-value">${safe(runNumber)}</div></div>
    <div class="meta-cell"><div class="meta-label">วันที่ส่ง</div><div class="meta-value">${dstr}</div></div>
    <div class="meta-cell"><div class="meta-label">จังหวัดที่จด</div><div class="meta-value">${safe(province)}</div></div>
    <div class="meta-cell"><div class="meta-label">จำนวนรายการ</div><div class="meta-value">${rows.length} คัน</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>เลขที่ใบขาย</th>
        <th>ชื่อลูกค้า</th>
        <th>ไฟแนนซ์</th>
        <th>รุ่น</th>
        <th>สี</th>
        <th>เลขเครื่อง</th>
        <th>เลขถัง (VIN)</th>
      </tr>
    </thead>
    <tbody>${tr}</tbody>
  </table>

  <div class="sign-grid">
    <div class="sign-box">
      <div class="sign-line">ลงชื่อ ........................................................</div>
      <div class="sign-sub">ผู้ส่งเอกสาร</div>
      <div class="sign-sub">วันที่ ${dstr}</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">ลงชื่อ ........................................................</div>
      <div class="sign-sub">ผู้รับเอกสาร</div>
      <div class="sign-sub">วันที่ ............ / ............ / ............</div>
    </div>
  </div>

  <div class="note">* พิมพ์จากระบบ Management | เลขรัน ${safe(runNumber)} | พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
</div>
</body></html>`;
}

function safe(s) {
  if (s === null || s === undefined) return "-";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
