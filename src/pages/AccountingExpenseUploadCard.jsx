import React, { useState } from "react";

// ฟีเจอร์: upload ไฟล์รายงานค่าใช้จ่าย (Excel) → บันทึกเข้า flow_expense_documents (ตารางแยกของ flow)
// - parse ฝั่ง client (header อยู่แถว 5, ข้อมูลเริ่มแถว 6)
// - นำเข้า "ทุกแถว" ที่มี (ไม่ต้องเลือก/ไม่ข้าม) — รวมแถวน้ำมัน
// - ใส่ F- หน้าเลขเอกสาร (เช่น EXP2026060035 → F-EXP2026060035) บอกว่ามาจาก flow + กันชนกับเอกสารสร้างมือ
// - เลือกสังกัด (ป.เปา / สิงห์ชัย) ตอน upload
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-accounting-expense";

const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];

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

export default function AccountingExpenseUploadCard({ currentUser }) {
  const [affiliation, setAffiliation] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);   // ทุกแถวที่จะนำเข้า (รวมน้ำมัน)
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleParse() {
    setMsg(""); setPreview([]);
    if (!file) { setMsg("⚠️ เลือกไฟล์ก่อน"); return; }
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets["ExpenseReport"] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

      // หาแถวหัวตาราง (คอลัมน์ A = "ลำดับที่")
      const hdrIdx = rows.findIndex(r => cellTxt(r[0]) === "ลำดับที่");
      if (hdrIdx < 0) throw new Error("ไม่พบหัวตาราง (คอลัมน์ 'ลำดับที่')");
      const hdr = rows[hdrIdx].map(cellTxt);
      const col = (name) => hdr.findIndex(h => h === name);
      const cDate = col("วัน/เดือน/ปี");
      const cDoc = col("เลขที่เอกสาร");
      const cTax = col("เลขผู้เสียภาษี");
      const cVendor = col("ชื่อผู้จำหน่าย");
      const cProject = col("ชื่อโปรเจ็ค");
      const cValue = col("มูลค่า");
      const cVat = col("ภาษีมูลค่าเพิ่ม");
      const cNet = col("ยอดรวมสุทธิ");
      const cType = col("ประเภทค่าใช้จ่าย");
      const cRef = col("เลขที่อ้างอิง");
      const cStatus = col("สถานะ");

      const out = [];
      for (let i = hdrIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const docNo = cellTxt(r[cDoc]);
        const dateStr = cellTxt(r[cDate]);
        if (!docNo && !dateStr) continue; // แถวว่าง
        if (!docNo) continue;
        const subtotal = num(r[cValue]);
        const vat = num(r[cVat]);
        const total = num(r[cNet]) || (subtotal + vat);
        const vatPct = subtotal > 0 && vat > 0 ? Math.round((vat / subtotal) * 100) : 0;
        const expType = cellTxt(r[cType]);
        // อ่านสถานะจาก FlowAccount → map "ยกเลิก" เป็น cancelled (ที่เหลือ draft)
        const statTxt = cStatus >= 0 ? cellTxt(r[cStatus]) : "";
        const status = /ยกเลิก/.test(statTxt) ? "cancelled" : "draft";
        // นำเข้าทุกแถว — ใส่ F- หน้าเลขเอกสาร
        out.push({
          expense_doc_no: "F-" + docNo,
          doc_date: thaiDateToIso(dateStr),
          vendor_name: cellTxt(r[cVendor]) || null,
          vendor_tax_id: cellTxt(r[cTax]) || null,
          reference_no: cellTxt(r[cRef]) || null,
          expense_type: expType || null,
          description: expType || cellTxt(r[cProject]) || null,
          subtotal, vat_pct: vatPct, vat_amount: vat, total, status,
        });
      }
      setPreview(out);
      setMsg(`✅ อ่านสำเร็จ — นำเข้าทุกแถว ${out.length} รายการ (ใส่ F- หน้าเลขเอกสาร)`);
    } catch (e) {
      setMsg("❌ อ่านไฟล์ล้มเหลว: " + e.message);
    }
    setParsing(false);
  }

  async function handleUpload() {
    if (!affiliation) { setMsg("⚠️ เลือกสังกัดก่อน"); return; }
    if (preview.length === 0) { setMsg("⚠️ กดอ่านไฟล์ก่อน"); return; }
    setUploading(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_expenses",
          affiliation,
          rows: preview,
          source_file: file?.name || null,
          uploaded_by: currentUser?.name || currentUser?.username || "system",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) throw new Error(ok?.error || "บันทึกล้มเหลว");
      const n = ok?.upserted ?? preview.length;
      setMsg(`✅ นำเข้า ${n} รายการ (สังกัด ${affiliation}) → ตาราง flow_expense_documents`);
      setPreview([]); setFile(null);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setUploading(false);
  }

  const total = preview.reduce((s, r) => s + Number(r.total || 0), 0);

  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, textAlign: "center" }}>
        ไฟล์ Excel รายงานค่าใช้จ่าย — นำเข้า "ทุกแถว" · ใส่ <code style={{ padding: "2px 6px", background: "#fee2e2", borderRadius: 4, color: "#991b1b", fontWeight: 600 }}>F-</code> หน้าเลขเอกสาร · UPSERT (สังกัด + เลขที่เอกสาร)
        · 📦 <code style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 4, color: "#374151" }}>flow_expense_documents</code> (แยกจากเอกสารสร้างมือ)
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label style={lbl}>🏢 สังกัด</label>
        <select value={affiliation} onChange={e => setAffiliation(e.target.value)} style={inp}>
          <option value="">— เลือกสังกัด —</option>
          {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <input type="file" accept=".xlsx,.xls"
          onChange={e => { setFile(e.target.files?.[0] || null); setPreview([]); setMsg(""); }}
          style={{ flex: "0 0 auto" }} />
        {file && <span style={{ fontSize: 11, color: "#6b7280" }}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>}
        <div style={{ flex: 1 }} />
        <button onClick={handleParse} disabled={parsing || !file}
          style={{ ...btn, background: parsing || !file ? "#9ca3af" : "#6366f1" }}>
          {parsing ? "📖 อ่าน..." : "📖 อ่านไฟล์"}
        </button>
        <button onClick={handleUpload} disabled={uploading || preview.length === 0 || !affiliation}
          style={{ ...btn, background: uploading || preview.length === 0 || !affiliation ? "#9ca3af" : "#15803d" }}>
          {uploading ? "💾 ..." : `💾 Upload ${preview.length || ""} รายการ`}
        </button>
      </div>

      {msg && <div style={{ fontSize: 12, marginBottom: 10, ...statusStyle(msg) }}>{msg}</div>}

      {preview.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#15803d", padding: "8px 10px", background: "#f0fdf4" }}>
            🔍 พรีวิว 5 แถวแรก — รวม {preview.length} รายการ · ยอดรวม {total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
          </div>
          <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
            <thead><tr>
              <th>เลขที่เอกสาร</th><th>วันที่</th><th>ผู้จำหน่าย</th><th>ประเภท</th>
              <th style={{ textAlign: "right" }}>มูลค่า</th><th style={{ textAlign: "right" }}>VAT</th><th style={{ textAlign: "right" }}>รวม</th>
            </tr></thead>
            <tbody>
              {preview.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#991b1b" }}>{r.expense_doc_no}</td>
                  <td>{r.doc_date || "-"}</td>
                  <td style={{ maxWidth: 220 }}>{r.vendor_name || "-"}</td>
                  <td style={{ fontSize: 11, color: "#6b7280" }}>{r.expense_type || "-"}</td>
                  <td style={{ textAlign: "right" }}>{r.subtotal.toLocaleString()}</td>
                  <td style={{ textAlign: "right" }}>{r.vat_amount.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const lbl = { fontSize: 13, fontWeight: 600, color: "#374151" };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const btn = { color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, padding: "7px 16px", fontSize: 13 };

function statusStyle(msg) {
  if (msg.startsWith("✅")) return { color: "#15803d", background: "#f0fdf4", border: "1px solid #86efac", padding: "6px 10px", borderRadius: 6 };
  if (msg.startsWith("❌")) return { color: "#b91c1c", background: "#fef2f2", border: "1px solid #fca5a5", padding: "6px 10px", borderRadius: 6 };
  return { color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "6px 10px", borderRadius: 6 };
}
