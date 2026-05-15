import React, { useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-tax-invoices";

const BRANCH_OPTS = [
  { value: "PAPAO",    label: "ป.เปา",    table: "other_income_tax_invoices_papao",    format: "NID-OTH" },
  { value: "SINGCHAI", label: "สิงห์ชัย", table: "other_income_tax_invoices_singchai", format: "MIC-OTH" },
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
  const decoder = new TextDecoder("windows-874");
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
function deriveYearMonth(isoDate) {
  if (!isoDate) return null;
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-/);
  if (!m) return null;
  return `${parseInt(m[1], 10) + 543}${m[2]}`;
}

/* -------------------- Extractors -------------------- */
// PAPAO Other Income: same column positions as NID (HONDA) format
// col 25=date, 26=invoice (69TF/xxxxxx), 27=customer, 28=tax_id, 29=branch, 30=before_vat, 31=vat, 32=total
function extractPapaoOther(rows, sourceFile) {
  const out = [];
  for (const r of rows) {
    const dateStr = (r[25] || "").trim();
    const invNo = (r[26] || "").trim();
    if (!invNo || !/^\d{2}TF\//i.test(invNo)) continue;
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
      source_file: sourceFile,
    });
  }
  return out;
}

// SINGCHAI Other Income (MCS RP-OTH-TAX-01): ; delimiter, data from row 10
// Row example: "1.02/05/2569;TF016905/0001;;customer_name;;;;tax_id;;branch;;;;before_vat;vat"
// col 1 = "row_number.DD/MM/YYYY" combined
// col 2 = tax_invoice_no
// col 4 = customer_name
// col 8 = customer_tax_id
// col 10 = customer_branch
// col 14 = amount_before_vat
// col 15 = vat_amount
function extractSingchaiOther(rows, sourceFile) {
  const out = [];
  for (const r of rows) {
    const c1 = (r[1] || "").trim();
    // Detect data row: "N.DD/MM/YYYY"
    const m = c1.match(/^\d+\.(\d{2}\/\d{2}\/\d{4})$/);
    if (!m) continue;
    const dateStr = m[1];
    const invNo = (r[2] || "").trim();
    if (!invNo) continue;
    const customer = (r[4] || "").trim();
    const isCancelled = customer.includes("ยกเลิก");
    const before = num(r[14]);
    const vat = num(r[15]);
    const total = (before != null && vat != null) ? Math.round((before + vat) * 100) / 100 : null;
    out.push({
      tax_invoice_no: invNo,
      invoice_date: thaiDateToIso(dateStr),
      customer_name: isCancelled ? null : customer,
      customer_tax_id: (r[8] || "").trim() || null,
      customer_branch: (r[10] || "").trim() || null,
      amount_before_vat: before,
      vat_amount: vat,
      total_amount: total,
      status: isCancelled ? "cancelled" : "active",
      source_file: sourceFile,
    });
  }
  return out;
}

/* ============================== Component ============================== */
export default function OtherIncomeTaxUploadPage({ currentUser, embeddable = false }) {
  const [branch, setBranch] = useState("PAPAO");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const branchOpt = BRANCH_OPTS.find(b => b.value === branch);
  const isMic = branch === "SINGCHAI";

  async function previewFile() {
    setMsg(""); setPreview([]);
    if (!file) { setMsg("⚠️ เลือกไฟล์ก่อน"); return; }
    setParsing(true);
    try {
      const rows = await readCsvAsTis620(file, isMic ? ";" : ",");
      const data = isMic ? extractSingchaiOther(rows, file.name) : extractPapaoOther(rows, file.name);
      setPreview(data);
      setMsg(`✅ อ่านสำเร็จ — พบ ${data.length} รายการ`);
    } catch (e) {
      setMsg("❌ อ่านล้มเหลว: " + e.message);
    }
    setParsing(false);
  }

  async function uploadFile() {
    if (preview.length === 0) { setMsg("⚠️ กดอ่านไฟล์ก่อน"); return; }
    setUploading(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_tax_invoices",
          mode: "other_income",
          branch,
          tax_invoices: preview.map(t => ({ ...t, invoice_year_month: deriveYearMonth(t.invoice_date) })),
          uploaded_by: currentUser?.user_id || currentUser?.name || "",
        }),
      });
      const data = await res.json();
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) setMsg("❌ " + (ok?.error || "บันทึกล้มเหลว"));
      else setMsg(`✅ บันทึก ${ok?.upserted ?? preview.length} รายการสำเร็จ`);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setUploading(false);
  }

  const inner = (
    <>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={lbl}>🏢 สาขา</label>
            <select value={branch} onChange={e => { setBranch(e.target.value); setFile(null); setPreview([]); setMsg(""); }} style={inp}>
              {BRANCH_OPTS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
              📦 Table: <code style={{ color: "#6366f1" }}>{branchOpt?.table}</code> · Format: {branchOpt?.format}
            </div>
          </div>
          <div>
            <label style={lbl}>👤 อัพโหลดโดย</label>
            <input type="text" value={currentUser?.name || currentUser?.user_id || ""} readOnly
              style={{ ...inp, background: "#f3f4f6", color: "#6b7280" }} />
          </div>
        </div>

        <div style={{ padding: "14px 16px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
            📑 ใบกำกับภาษีรายรับอื่นๆ ({branchOpt?.label}) — CSV TIS-620
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept=".csv" onChange={e => { setFile(e.target.files?.[0] || null); setPreview([]); setMsg(""); }} />
            {file && <span style={{ fontSize: 11, color: "#6b7280" }}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>}
            <div style={{ flex: 1 }} />
            <button onClick={previewFile} disabled={parsing || !file}
              style={{ ...btn, background: parsing ? "#9ca3af" : "#6366f1", padding: "7px 14px", fontSize: 13 }}>
              {parsing ? "📖 อ่าน..." : "📖 อ่านไฟล์"}
            </button>
            <button onClick={uploadFile} disabled={uploading || preview.length === 0}
              style={{ ...btn, background: uploading ? "#9ca3af" : "#92400e", padding: "7px 18px", fontSize: 13 }}>
              {uploading ? "💾 ..." : `💾 Upload ${preview.length || ""} รายการ`}
            </button>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12, ...statusStyle(msg) }}>{msg}</div>}
        </div>
      </div>

      {preview.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
          <h3 style={{ margin: "0 0 12px", color: "#072d6b", fontSize: 15 }}>
            🔍 พรีวิว ({preview.length} รายการ — แสดง 10 แถวแรก)
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
              <thead>
                <tr>
                  <th>เลขที่ใบกำกับ</th><th>วันที่</th><th>ลูกค้า</th><th>เลขผู้เสียภาษี</th>
                  <th style={{ textAlign: "right" }}>ก่อน VAT</th><th style={{ textAlign: "right" }}>VAT</th>
                  <th style={{ textAlign: "right" }}>รวม</th><th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((t, i) => (
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
        </div>
      )}
    </>
  );

  if (embeddable) return inner;
  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">💰 อัพโหลดใบกำกับรายรับอื่นๆ</div>
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
