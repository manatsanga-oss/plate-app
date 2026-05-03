import React, { useState } from "react";

// ใช้ webhook เดียวกับ Upload Registration Receipts workflow
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-tax-invoices";
const CHECK_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/check-tax-invoices-exist";

const BRANCH_OPTS = [
  { value: "PAPAO", label: "ป.เปา", table: "tax_invoices_papao", format: "NID" },
  { value: "NAKORNLUANG", label: "นครหลวง", table: "tax_invoices_nakornluang", format: "NID" },
  { value: "SINGCHAI", label: "สิงห์ชัย", table: "tax_invoices_singchai", format: "MIC" },
];

/* -------------------------------- CSV parser -------------------------------- */
function parseCsvText(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delimiter) { row.push(cur); cur = ""; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function readCsvAsTis620(file, delimiter = ",") {
  const buf = await file.arrayBuffer();
  const decoder = new TextDecoder("windows-874"); // ≈ TIS-620
  return parseCsvText(decoder.decode(buf), delimiter);
}

function thaiDateToIso(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const y = parseInt(m[3], 10);
  const yyyy = y > 2400 ? y - 543 : y;
  return `${yyyy}-${m[2]}-${m[1]}`;
}

function num(s) {
  if (s == null) return null;
  const t = String(s).replace(/,/g, "").trim();
  if (!t || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* -------------------- Extractors -------------------- */
// NID-รายงานภาษีขาย: col 25/26/27/28/29/30/31/32
function extractTaxInvoices(rows, sourceFile) {
  const out = [];
  for (const r of rows) {
    const dateStr = (r[25] || "").trim();
    const invNo = (r[26] || "").trim();
    if (!invNo || !/^\d{2}MC\//i.test(invNo)) continue;
    const customer = (r[27] || "").trim();
    const isCancelled = customer.includes("ยกเลิก");
    out.push({
      tax_invoice_no: invNo,
      invoice_date: thaiDateToIso(dateStr),
      customer_name: isCancelled ? null : customer,
      customer_tax_id: (r[28] || "").trim() || null,
      customer_branch: (r[29] || "").trim() || null,
      amount_before_vat: num(r[30]),
      vat_amount: num(r[31]),
      total_amount: num(r[32]),
      status: isCancelled ? "cancelled" : "active",
      source_file_tax: sourceFile,
    });
  }
  return out;
}

// MIC-รายงานขายรถสิงห์ชัย (single file มีทั้ง tax + profit)
// Format: ;-delimited
//   Group header: [0] = "ยี่ห้อ ... รุ่น ..."
//   Data row: [0]=วันที่, [2]=engine_no, [4]=chassis_no, [6]=tax_invoice_no, [9]=ราคาขาย, [10]=ทุน, [12]=กำไร
function extractMicSingchai(rows, sourceFile) {
  const taxOut = [];
  const profitOut = [];
  let currentModel = null;
  for (const r of rows) {
    const c0 = (r[0] || "").trim();
    // Detect model header
    if (/^ยี่ห้อ.+รุ่น/.test(c0)) {
      currentModel = c0.replace(/^ยี่ห้อ\s*/, "");
      continue;
    }
    // Data row: c0 = DD/MM/YYYY
    const dateStr = c0;
    if (!/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) continue;
    const invNo = (r[6] || "").trim();
    if (!invNo) continue;
    const engineNo = (r[2] || "").trim() || null;
    const chassisNo = (r[4] || "").trim() || null;
    const salePrice = num(r[9]); // ราคาขาย — ใช้เป็น amount_before_vat (ตาม MIC, 7% VAT)
    const costPrice = num(r[10]);
    const grossProfit = num(r[12]);
    const vat = salePrice ? Math.round(salePrice * 0.07 * 100) / 100 : null;
    const total = salePrice ? Math.round((salePrice + (vat || 0)) * 100) / 100 : null;

    // Tax invoice row (no customer in MIC file)
    taxOut.push({
      tax_invoice_no: invNo,
      invoice_date: thaiDateToIso(dateStr),
      customer_name: null,
      customer_tax_id: null,
      customer_branch: null,
      amount_before_vat: salePrice,
      vat_amount: vat,
      total_amount: total,
      status: "active",
      source_file_tax: sourceFile,
    });
    // Profit row
    profitOut.push({
      tax_invoice_no: invNo,
      chassis_no: chassisNo,
      engine_no: engineNo,
      model_name: currentModel,
      cost_price: costPrice,
      gross_profit: grossProfit,
      source_file_profit: sourceFile,
    });
  }
  return { taxOut, profitOut };
}

// NID-รายงานกำไรขั้นต้น: col 16/17/18/19/20/21/22/23
function extractGrossProfit(rows, sourceFile) {
  const out = [];
  for (const r of rows) {
    const invNo = (r[20] || "").trim();
    if (!invNo || !/^\d{2}MC\//i.test(invNo)) continue;
    out.push({
      tax_invoice_no: invNo,
      chassis_no: (r[18] || "").trim() || null,
      engine_no: (r[19] || "").trim() || null,
      model_name: (r[16] || "").trim() || null,
      cost_price: num(r[22]),
      gross_profit: num(r[23]),
      source_file_profit: sourceFile,
    });
  }
  return out;
}

/* ============================== Component ============================== */
// แปลง invoice_date (ISO "YYYY-MM-DD" ค.ศ.) → invoice_year_month "YYYYMM" พ.ศ.
function deriveYearMonth(isoDate) {
  if (!isoDate) return null;
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-/);
  if (!m) return null;
  const yearAD = parseInt(m[1], 10);
  const yearBE = yearAD + 543;
  return `${yearBE}${m[2]}`;
}

export default function TaxInvoiceUploadPage({ currentUser, embeddable = false }) {
  const [branch, setBranch] = useState("PAPAO");

  // File 1: ใบกำกับภาษี
  const [taxFile, setTaxFile] = useState(null);
  const [taxFolder, setTaxFolder] = useState(""); // folder name
  const [previewTax, setPreviewTax] = useState([]);
  const [parsingTax, setParsingTax] = useState(false);
  const [uploadingTax, setUploadingTax] = useState(false);
  const [msgTax, setMsgTax] = useState("");
  const [duplicates, setDuplicates] = useState([]); // existing rows ที่ซ้ำ
  const [allowOverwrite, setAllowOverwrite] = useState(false);

  // File 2: กำไรขั้นต้น
  const [profitFile, setProfitFile] = useState(null);
  const [profitFolder, setProfitFolder] = useState("");
  const [previewProfit, setPreviewProfit] = useState([]);
  const [parsingProfit, setParsingProfit] = useState(false);
  const [uploadingProfit, setUploadingProfit] = useState(false);
  const [msgProfit, setMsgProfit] = useState("");

  // helper: extract folder name from File via webkitRelativePath
  function getFolderName(file) {
    if (!file) return "";
    const rel = file.webkitRelativePath || "";
    if (rel && rel.includes("/")) {
      // e.g. "รายงานภาษีขาย/04-2569.CSV" → "รายงานภาษีขาย"
      // หรือ "Parent/Sub/file.csv" → "Parent/Sub"
      const parts = rel.split("/");
      return parts.slice(0, parts.length - 1).join("/");
    }
    return "";
  }

  function validateBranch() {
    if (!branch) return "เลือกสาขาก่อน";
    return "";
  }

  const isMic = branch === "SINGCHAI";

  /* ======== Tax Invoice flow ======== */
  async function previewTaxFile() {
    setMsgTax("");
    setPreviewTax([]);
    if (isMic) setPreviewProfit([]);
    if (!taxFile) { setMsgTax("⚠️ เลือกไฟล์ก่อน"); return; }
    setParsingTax(true);
    try {
      if (isMic) {
        // MIC: ใช้ ; delimiter + parse เป็นทั้ง tax และ profit
        const rows = await readCsvAsTis620(taxFile, ";");
        const { taxOut, profitOut } = extractMicSingchai(rows, taxFile.name);
        setPreviewTax(taxOut);
        setPreviewProfit(profitOut);
        setMsgTax(`✅ อ่านสำเร็จ (MIC) — ${taxOut.length} ใบกำกับ + ${profitOut.length} รายการกำไร`);
      } else {
        const rows = await readCsvAsTis620(taxFile);
        const data = extractTaxInvoices(rows, taxFile.name);
        setPreviewTax(data);
        setMsgTax(`✅ อ่านสำเร็จ — พบ ${data.length} รายการ`);
      }
    } catch (e) {
      setMsgTax("❌ อ่านล้มเหลว: " + e.message);
    }
    setParsingTax(false);
  }

  async function uploadTaxFile() {
    const v = validateBranch();
    if (v) { setMsgTax("⚠️ " + v); return; }
    if (previewTax.length === 0) { setMsgTax("⚠️ กดอ่านไฟล์ก่อน"); return; }
    setUploadingTax(true);
    setMsgTax("");

    // ── Step 0: Check duplicate ก่อน upload ──
    if (!allowOverwrite) {
      try {
        const invNos = previewTax.map(t => t.tax_invoice_no).filter(Boolean);
        const resCk = await fetch(CHECK_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branch, invoice_nos: invNos }),
        });
        const dCk = await resCk.json();
        const existing = (Array.isArray(dCk) ? dCk[0] : dCk)?.existing || [];
        if (existing.length > 0) {
          setDuplicates(existing);
          setMsgTax(`⚠️ พบเลขที่ใบกำกับซ้ำในฐานข้อมูล ${existing.length}/${invNos.length} ใบ — ไม่ upload เพื่อกันซ้ำ (ถ้าต้องการ overwrite ติ๊ก checkbox แล้วกด Upload อีกครั้ง)`);
          setUploadingTax(false);
          return;
        }
        setDuplicates([]);
      } catch (e) {
        setMsgTax("❌ เช็คซ้ำล้มเหลว: " + e.message);
        setUploadingTax(false);
        return;
      }
    }

    try {
      // Step 1: upload tax
      const res1 = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_tax_invoices",
          mode: "tax",
          branch,
          tax_invoices: previewTax.map(t => ({ ...t, invoice_year_month: deriveYearMonth(t.invoice_date) })),
          uploaded_by: currentUser?.user_id || currentUser?.name || "",
        }),
      });
      const d1 = await res1.json();
      const ok1 = Array.isArray(d1) ? d1[0] : d1;
      if (ok1?.success === false) { setMsgTax("❌ " + (ok1?.error || "บันทึกใบกำกับล้มเหลว")); setUploadingTax(false); return; }

      // Step 2 (MIC only): upload profit ในครั้งเดียวกัน
      if (isMic && previewProfit.length > 0) {
        const res2 = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_tax_invoices",
            mode: "profit",
            branch,
            gross_profit: previewProfit,
            uploaded_by: currentUser?.user_id || currentUser?.name || "",
          }),
        });
        const d2 = await res2.json();
        const ok2 = Array.isArray(d2) ? d2[0] : d2;
        if (ok2?.success === false) {
          setMsgTax(`✅ ใบกำกับ ${previewTax.length} ⚠️ profit ล้มเหลว: ${ok2?.error || ""}`);
        } else {
          setMsgTax(`✅ บันทึก MIC สำเร็จ: ใบกำกับ ${previewTax.length} + กำไร ${previewProfit.length} รายการ`);
        }
      } else {
        setMsgTax(`✅ บันทึกใบกำกับภาษี ${ok1?.upserted ?? previewTax.length} รายการสำเร็จ`);
      }
    } catch (e) {
      setMsgTax("❌ " + e.message);
    }
    setUploadingTax(false);
  }

  /* ======== Gross Profit flow ======== */
  async function previewProfitFile() {
    setMsgProfit("");
    setPreviewProfit([]);
    if (!profitFile) { setMsgProfit("⚠️ เลือกไฟล์ก่อน"); return; }
    setParsingProfit(true);
    try {
      const rows = await readCsvAsTis620(profitFile);
      const data = extractGrossProfit(rows, profitFile.name);
      setPreviewProfit(data);
      setMsgProfit(`✅ อ่านสำเร็จ — พบ ${data.length} รายการ`);
    } catch (e) {
      setMsgProfit("❌ อ่านล้มเหลว: " + e.message);
    }
    setParsingProfit(false);
  }

  async function uploadProfitFile() {
    const v = validateBranch();
    if (v) { setMsgProfit("⚠️ " + v); return; }
    if (previewProfit.length === 0) { setMsgProfit("⚠️ กดอ่านไฟล์ก่อน"); return; }
    setUploadingProfit(true);
    setMsgProfit("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_tax_invoices",
          mode: "profit",
          branch,
          gross_profit: previewProfit,
          uploaded_by: currentUser?.user_id || currentUser?.name || "",
        }),
      });
      const data = await res.json();
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) setMsgProfit("❌ " + (ok?.error || "บันทึกล้มเหลว"));
      else setMsgProfit(`✅ บันทึกกำไรขั้นต้น ${ok?.matched ?? 0} จาก ${previewProfit.length} รายการ (matched ผ่าน tax_invoice_no)`);
    } catch (e) {
      setMsgProfit("❌ " + e.message);
    }
    setUploadingProfit(false);
  }

  const branchOpt = BRANCH_OPTS.find(b => b.value === branch);

  const inner = (
    <>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 20 }}>
        {/* Step 1: branch */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={lbl}>🏢 สาขา</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} style={inp}>
              {BRANCH_OPTS.map(b => (
                <option key={b.value} value={b.value} disabled={b.disabled}>{b.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
              📦 Table: <code style={{ color: "#6366f1" }}>{branchOpt?.table}</code> ·
              เดือนจะถูกอ่านจากวันที่ในไฟล์อัตโนมัติ (เก็บใน <code>invoice_year_month</code>)
            </div>
          </div>
          <div>
            <label style={lbl}>👤 อัพโหลดโดย</label>
            <input type="text" value={currentUser?.name || currentUser?.user_id || ""} readOnly
              style={{ ...inp, background: "#f3f4f6", color: "#6b7280" }} />
          </div>
        </div>

        {/* File 1: ใบกำกับภาษี (NID format) หรือ MIC ทั้งไฟล์เดียว */}
        <div style={{ padding: "14px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>
            {isMic
              ? "📑 ไฟล์ MIC (สิงห์ชัย) — รวมใบกำกับ + กำไรขั้นต้น (1 ไฟล์)"
              : "📑 ขั้นตอนที่ 1 — ใบกำกับภาษี (NID-รายงานภาษีขาย)"}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept=".csv" onChange={e => { setTaxFile(e.target.files?.[0] || null); setPreviewTax([]); setMsgTax(""); setDuplicates([]); setAllowOverwrite(false); }}
              style={{ flex: "0 0 auto" }} />
            {taxFile && <span style={{ fontSize: 11, color: "#6b7280" }}>{taxFile.name} ({(taxFile.size / 1024).toFixed(1)} KB)</span>}
            <div style={{ flex: 1 }} />
            <button onClick={previewTaxFile} disabled={parsingTax || !taxFile}
              style={{ ...btn, background: parsingTax ? "#9ca3af" : "#6366f1", padding: "7px 14px", fontSize: 13 }}>
              {parsingTax ? "📖 อ่าน..." : "📖 อ่านไฟล์"}
            </button>
            <button onClick={uploadTaxFile} disabled={uploadingTax || previewTax.length === 0}
              style={{ ...btn, background: uploadingTax ? "#9ca3af" : "#15803d", padding: "7px 18px", fontSize: 13 }}>
              {uploadingTax ? "💾 ..." : `💾 Upload ${previewTax.length || ""} รายการ`}
            </button>
          </div>
          {msgTax && <div style={{ marginTop: 8, fontSize: 12, ...statusStyle(msgTax) }}>{msgTax}</div>}
          {duplicates.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>
                🚫 เลขที่ใบกำกับซ้ำในฐานข้อมูล ({duplicates.length} รายการ)
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 11, marginBottom: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#fee2e2" }}>
                      <th style={{ padding: "4px 8px", textAlign: "left", border: "1px solid #fca5a5" }}>เลขที่ใบกำกับ</th>
                      <th style={{ padding: "4px 8px", textAlign: "left", border: "1px solid #fca5a5" }}>เดือน</th>
                      <th style={{ padding: "4px 8px", textAlign: "left", border: "1px solid #fca5a5" }}>ลูกค้า</th>
                      <th style={{ padding: "4px 8px", textAlign: "right", border: "1px solid #fca5a5" }}>ยอดรวม</th>
                      <th style={{ padding: "4px 8px", textAlign: "left", border: "1px solid #fca5a5" }}>upload เมื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.map((d, i) => (
                      <tr key={i}>
                        <td style={{ padding: "3px 8px", fontFamily: "monospace", fontWeight: 600, color: "#991b1b", border: "1px solid #fecaca" }}>{d.tax_invoice_no}</td>
                        <td style={{ padding: "3px 8px", border: "1px solid #fecaca", fontFamily: "monospace" }}>{d.invoice_year_month || "-"}</td>
                        <td style={{ padding: "3px 8px", border: "1px solid #fecaca" }}>{d.customer_name || "-"}</td>
                        <td style={{ padding: "3px 8px", border: "1px solid #fecaca", textAlign: "right" }}>{Number(d.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "3px 8px", border: "1px solid #fecaca", color: "#6b7280" }}>{d.uploaded_at ? String(d.uploaded_at).slice(0, 19).replace("T", " ") : "-"} {d.uploaded_by ? `by ${d.uploaded_by}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label style={{ fontSize: 12, color: "#7c2d12", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={allowOverwrite} onChange={e => setAllowOverwrite(e.target.checked)} />
                ✅ อนุญาตให้เขียนทับ (overwrite) ข้อมูลเดิม — กด "Upload" อีกครั้งเพื่อยืนยัน
              </label>
            </div>
          )}
        </div>

        {/* File 2: กำไรขั้นต้น — ซ่อนเมื่อเป็น MIC */}
        {!isMic && (
        <div style={{ padding: "14px 16px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>📊 ขั้นตอนที่ 2 — กำไรขั้นต้น (NID-รายงานกำไรขั้นต้น) — UPDATE chassis/engine/model</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept=".csv" onChange={e => { setProfitFile(e.target.files?.[0] || null); setPreviewProfit([]); setMsgProfit(""); }}
              style={{ flex: "0 0 auto" }} />
            {profitFile && <span style={{ fontSize: 11, color: "#6b7280" }}>{profitFile.name} ({(profitFile.size / 1024).toFixed(1)} KB)</span>}
            <div style={{ flex: 1 }} />
            <button onClick={previewProfitFile} disabled={parsingProfit || !profitFile}
              style={{ ...btn, background: parsingProfit ? "#9ca3af" : "#6366f1", padding: "7px 14px", fontSize: 13 }}>
              {parsingProfit ? "📖 อ่าน..." : "📖 อ่านไฟล์"}
            </button>
            <button onClick={uploadProfitFile} disabled={uploadingProfit || previewProfit.length === 0}
              style={{ ...btn, background: uploadingProfit ? "#9ca3af" : "#1e40af", padding: "7px 18px", fontSize: 13 }}>
              {uploadingProfit ? "💾 ..." : `💾 Upload ${previewProfit.length || ""} รายการ`}
            </button>
          </div>
          {msgProfit && <div style={{ marginTop: 8, fontSize: 12, ...statusStyle(msgProfit) }}>{msgProfit}</div>}
        </div>
        )}
      </div>

      {/* Preview */}
      {(previewTax.length > 0 || previewProfit.length > 0) && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
          <h3 style={{ margin: "0 0 12px", color: "#072d6b", fontSize: 15 }}>
            🔍 พรีวิว (5 แถวแรก) — ใบกำกับ {previewTax.length} · กำไร {previewProfit.length}
          </h3>
          {previewTax.length > 0 && (
            <div style={{ overflowX: "auto", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#15803d", marginBottom: 6 }}>📑 ใบกำกับภาษี</div>
              <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
                <thead>
                  <tr>
                    <th>เลขที่ใบกำกับ</th><th>วันที่</th><th>ลูกค้า</th><th>เลขผู้เสียภาษี</th>
                    <th style={{ textAlign: "right" }}>ก่อน VAT</th><th style={{ textAlign: "right" }}>VAT</th>
                    <th style={{ textAlign: "right" }}>รวม</th><th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {previewTax.slice(0, 5).map((t, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{t.tax_invoice_no}</td>
                      <td>{t.invoice_date || "-"}</td>
                      <td>{t.customer_name || (t.status === "cancelled" ? <em style={{ color: "#dc2626" }}>ยกเลิก</em> : "-")}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{t.customer_tax_id || "-"}</td>
                      <td style={{ textAlign: "right" }}>{t.amount_before_vat?.toLocaleString() || "-"}</td>
                      <td style={{ textAlign: "right" }}>{t.vat_amount?.toLocaleString() || "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{t.total_amount?.toLocaleString() || "-"}</td>
                      <td>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: t.status === "cancelled" ? "#fee2e2" : "#dcfce7",
                          color: t.status === "cancelled" ? "#991b1b" : "#065f46" }}>{t.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {previewProfit.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1e40af", marginBottom: 6 }}>📊 กำไรขั้นต้น</div>
              <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
                <thead>
                  <tr>
                    <th>เลขที่ใบกำกับ</th><th>เลขถัง</th><th>เลขเครื่อง</th><th>รุ่น</th>
                    <th style={{ textAlign: "right" }}>ทุน</th><th style={{ textAlign: "right" }}>กำไร</th>
                  </tr>
                </thead>
                <tbody>
                  {previewProfit.slice(0, 5).map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{p.tax_invoice_no}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{p.chassis_no || "-"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{p.engine_no || "-"}</td>
                      <td style={{ fontSize: 11, color: "#6b7280" }}>{p.model_name || "-"}</td>
                      <td style={{ textAlign: "right" }}>{p.cost_price?.toLocaleString() || "-"}</td>
                      <td style={{ textAlign: "right", color: "#15803d", fontWeight: 600 }}>{p.gross_profit?.toLocaleString() || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (embeddable) return inner;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">📄 อัพโหลดใบกำกับ HONDA</div>
      </div>
      {inner}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const btn = { color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 };

function statusStyle(msg) {
  if (msg.startsWith("✅")) return { color: "#15803d", background: "#f0fdf4", border: "1px solid #86efac", padding: "5px 10px", borderRadius: 6 };
  if (msg.startsWith("❌")) return { color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", padding: "5px 10px", borderRadius: 6 };
  return { color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "5px 10px", borderRadius: 6 };
}
