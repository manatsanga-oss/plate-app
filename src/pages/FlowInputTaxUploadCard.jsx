import React, { useState } from "react";

// ฟีเจอร์: upload รายงานภาษีซื้อ (ภ.พ.30) ที่ export จาก FLOW ACC (FlowAccount)
// - ไฟล์ .xlsx sheet "InputTaxReport" : หัวรายงาน 4 บรรทัด, หัวตารางแถวที่คอลัมน์ A = "ลำดับที่", ข้อมูลต่อจากนั้น, แถวสุดท้าย = ยอดรวม
// - parse ฝั่ง client → ส่ง rows ให้ webhook flow-input-tax-api (action upload_input_tax_report)
// - นำเข้าแบบ "แทนที่ทั้งรอบ" (DELETE สังกัด+รอบยื่น แล้ว INSERT ใหม่) — re-upload เดือนเดิม = ทับของเก่า
// - แยกสังกัด: การ์ดนี้ล็อกสังกัด (prop affiliation) — เรนเดอร์ 2 ใบ ป.เปา / สิงห์ชัย
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/flow-input-tax-api";

function thaiDateToIso(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function num(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
function cellTxt(v) {
  return String(v == null ? "" : v).trim();
}
// "05-2026 (รอบปกติ)" หรือ "05-2569" → { period: "2026-05" }
function parsePeriod(s) {
  if (!s) return "";
  const m = String(s).match(/(\d{1,2})[-/](\d{4})/);
  if (!m) return "";
  let y = parseInt(m[2], 10);
  if (y > 2400) y -= 543;
  const mo = m[1].padStart(2, "0");
  return `${y}-${mo}`;
}

export default function FlowInputTaxUploadCard({ currentUser, affiliation }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [head, setHead] = useState(null); // { period, company_name, company_tax_id, sumBase, sumVat }
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleParse(theFile) {
    setMsg(""); setRows([]); setHead(null);
    const f = theFile || file;
    if (!f) { setMsg("⚠️ เลือกไฟล์ก่อน"); return; }
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets["InputTaxReport"] || wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

      // ---- หัวรายงาน: ชื่อผู้ประกอบการ + เลขผู้เสียภาษี (บรรทัดที่ขึ้นต้น "ชื่อผู้ประกอบการ") ----
      let companyName = "", companyTaxId = "";
      for (let i = 0; i < Math.min(grid.length, 6); i++) {
        const t = cellTxt(grid[i][0]);
        if (t.startsWith("ชื่อผู้ประกอบการ")) {
          const idm = t.match(/(\d{13})/);
          companyTaxId = idm ? idm[1] : "";
          companyName = t.replace(/^ชื่อผู้ประกอบการ\s*/, "").replace(/เลขประจำตัวผู้เสียภาษี.*$/, "").trim();
        }
      }

      // ---- หัวตาราง: แถวที่คอลัมน์ A = "ลำดับที่" ----
      const hdrIdx = grid.findIndex(r => cellTxt(r[0]) === "ลำดับที่");
      if (hdrIdx < 0) throw new Error("ไม่พบหัวตาราง (คอลัมน์ 'ลำดับที่') — ตรวจว่าเป็นไฟล์รายงานภาษีซื้อ ภ.พ.30");
      const hdr = grid[hdrIdx].map(cellTxt);
      const col = (name, fallbackIdx) => { const i = hdr.findIndex(h => h === name); return i >= 0 ? i : fallbackIdx; };
      const cSeq = col("ลำดับที่", 0);
      const cDate = col("วันที่ใบกำกับภาษี", 1);
      const cInv = col("เลขที่ใบกำกับภาษี", 2);
      const cRef = col("เลขที่อ้างอิง", 3);
      const cVendor = col("ชื่อผู้จำหน่าย", 4);
      const cBranchNote = col("สาขา", 5);
      const cTax = col("เลขที่ผู้เสียภาษี", 6);
      const cBranchType = col("สำนักงานใหญ่/สาขา", 7);
      const cBase = col("มูลค่า", 8);
      const cVat = col("จำนวนภาษีมูลค่าเพิ่ม", 9);
      const cSys = col("เอกสารอ้างอิงระบบ", 10);
      const cStatus = col("สถานะ", 11);
      const cRound = col("รอบยื่นภาษี", 12);

      const out = [];
      let period = "";
      for (let i = hdrIdx + 1; i < grid.length; i++) {
        const r = grid[i];
        const seqTxt = cellTxt(r[cSeq]);
        if (!/^\d+$/.test(seqTxt)) continue; // ข้ามแถวว่าง + แถวยอดรวม (ลำดับไม่ใช่ตัวเลข)
        const round = cellTxt(r[cRound]);
        if (!period) period = parsePeriod(round);
        out.push({
          seq: parseInt(seqTxt, 10),
          tax_invoice_date: thaiDateToIso(cellTxt(r[cDate])),
          tax_invoice_no: cellTxt(r[cInv]) || null,
          reference_no: cellTxt(r[cRef]) || null,
          vendor_name: cellTxt(r[cVendor]) || null,
          vendor_branch_note: cellTxt(r[cBranchNote]) || null,
          vendor_tax_id: cellTxt(r[cTax]) || null,
          branch_type: cellTxt(r[cBranchType]) || null,
          amount_before_vat: num(r[cBase]),
          vat_amount: num(r[cVat]),
          system_ref: cellTxt(r[cSys]) || null,
          doc_status: cellTxt(r[cStatus]) || null,
          filing_round: round || null,
        });
      }
      if (out.length === 0) throw new Error("ไม่พบรายการในไฟล์");
      if (!period) period = parsePeriod(f.name); // fallback จากชื่อไฟล์ 05-2569.xlsx

      const sumBase = out.reduce((s, r) => s + r.amount_before_vat, 0);
      const sumVat = out.reduce((s, r) => s + r.vat_amount, 0);
      setRows(out);
      setHead({ period, company_name: companyName, company_tax_id: companyTaxId, sumBase, sumVat });
      setMsg(`✅ อ่านสำเร็จ ${out.length} รายการ · รอบยื่น ${period || "?"}`);
    } catch (e) {
      setMsg("❌ อ่านไฟล์ล้มเหลว: " + e.message);
    }
    setParsing(false);
  }

  async function handleUpload() {
    if (rows.length === 0) { setMsg("⚠️ กดอ่านไฟล์ก่อน"); return; }
    if (!head?.period) { setMsg("⚠️ ระบุรอบยื่นไม่ได้ (ตรวจคอลัมน์ 'รอบยื่นภาษี' หรือชื่อไฟล์ MM-YYYY)"); return; }
    setUploading(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_input_tax_report",
          affiliation,
          tax_period: head.period,
          company_name: head.company_name || null,
          company_tax_id: head.company_tax_id || null,
          rows,
          source_file: file?.name || null,
          uploaded_by: currentUser?.name || currentUser?.username || "system",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) throw new Error(ok?.error || "บันทึกล้มเหลว");
      const n = ok?.upserted ?? rows.length;
      setMsg(`✅ นำเข้า ${n} รายการ (${affiliation} · รอบ ${head.period}) → flow_input_tax_reports`);
      setRows([]); setHead(null); setFile(null);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setUploading(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <input type="file" accept=".xlsx,.xls"
          onChange={e => { const f = e.target.files?.[0] || null; setFile(f); setRows([]); setHead(null); setMsg(""); if (f) handleParse(f); }}
          style={{ flex: "0 0 auto", fontSize: 12 }} />
        {file && <span style={{ fontSize: 11, color: "#6b7280" }}>{(file.size / 1024).toFixed(0)} KB</span>}
      </div>

      {msg && <div style={{ fontSize: 12, marginBottom: 10, ...statusStyle(msg) }}>{msg}</div>}

      {head && rows.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ fontSize: 12, padding: "8px 10px", background: "#f0fdf4", color: "#15803d" }}>
            <div><b>รอบยื่น:</b> {head.period} · <b>{rows.length}</b> รายการ</div>
            {head.company_name && <div style={{ color: "#374151" }}>{head.company_name} {head.company_tax_id ? `(${head.company_tax_id})` : ""}</div>}
            <div>มูลค่ารวม <b>{head.sumBase.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</b> · ภาษีซื้อรวม <b>{head.sumVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</b></div>
          </div>
          <table className="data-table" style={{ fontSize: 11, width: "100%" }}>
            <thead><tr>
              <th>วันที่</th><th>เลขที่ใบกำกับ</th><th>ผู้จำหน่าย</th>
              <th style={{ textAlign: "right" }}>มูลค่า</th><th style={{ textAlign: "right" }}>VAT</th>
            </tr></thead>
            <tbody>
              {rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  <td>{r.tax_invoice_date || "-"}</td>
                  <td style={{ fontFamily: "monospace" }}>{r.tax_invoice_no || "-"}</td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.vendor_name || "-"}</td>
                  <td style={{ textAlign: "right" }}>{r.amount_before_vat.toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}>{r.vat_amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={handleUpload} disabled={uploading || rows.length === 0}
        style={{ ...btn, width: "100%", background: uploading || rows.length === 0 ? "#9ca3af" : "#15803d" }}>
        {uploading ? "💾 กำลังนำเข้า..." : `💾 Upload ${rows.length || ""} รายการ`}
      </button>
    </div>
  );
}

const btn = { color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, padding: "8px 16px", fontSize: 13 };

function statusStyle(msg) {
  if (msg.startsWith("✅")) return { color: "#15803d", background: "#f0fdf4", border: "1px solid #86efac", padding: "6px 10px", borderRadius: 6 };
  if (msg.startsWith("❌")) return { color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", padding: "6px 10px", borderRadius: 6 };
  return { color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "6px 10px", borderRadius: 6 };
}
