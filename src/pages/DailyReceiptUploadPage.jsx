import React, { useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-daily-receipts";
const TRANSFER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-receipt-transfers";

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

async function readCsvFile(file) {
  const buf = await file.arrayBuffer();
  // ใช้ utf-8 ก่อน (ไฟล์ EX มี BOM utf-8); fallback windows-874
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-874").decode(buf);
  }
  // ตัด BOM ถ้ามี
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return parseCsvText(text);
}

function num(s) {
  if (s == null) return 0;
  const t = String(s).replace(/,/g, "").trim();
  if (!t || t === "-") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function dateTime(s) {
  if (!s) return null;
  // "2026-01-03 10:51:27" → "2026-01-03T10:51:27"
  return String(s).replace(" ", "T");
}

function getBranchFromReceipt(receiptNo) {
  if (!receiptNo) return null;
  const m = String(receiptNo).match(/^([A-Z0-9]+)-/);
  return m ? m[1] : null;
}

/* -------------------- Extractor for Transfer Report (26 cols) -------------------- */
// แต่ละกลุ่มมี header row "เลขที่บัญชี: XXX" + bank info, ตามด้วย data rows
// Header (row 9): col[1]=วันที่ col[4]=เลขใบเสร็จ col[10]=จำนวน col[13]=เงินโอน col[14]=Fee col[19]=ลูกค้า col[25]=สาขา
// Bank header (row 10): col[1]="เลขที่บัญชี" col[6]=accountNo col[11]=accountPurpose col[19]=bankName
// Data rows: col[0]=running col[1]=date col[4]=receiptNo col[10]=total col[13]=transfer col[14]=fee col[22]=customer col[25]=branch
// Subtotal row: col[7]="เลขที่บัญชี xxx" col[19]="รวม X รายการ"
function thaiDateToIso(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (y < 100) y += (y < 50 ? 2500 : 2400);  // 69 → 2569
  if (y > 2400) y -= 543;
  return `${y}-${m[2]}-${m[1]}`;
}

function extractReceiptTransfers(rows, sourceFile) {
  const out = [];
  let currentAccount = null;
  let currentBank = null;
  let currentPurpose = null;
  for (const r of rows) {
    const c1 = (r[1] || "").trim();
    const c4 = (r[4] || "").trim();
    const c6 = (r[6] || "").trim();
    const c11 = (r[11] || "").trim();
    const c19 = (r[19] || "").trim();
    const c22 = (r[22] || "").trim();
    const c25 = (r[25] || "").trim();

    // Bank header row
    if (c1 === "เลขที่บัญชี" && c6) {
      currentAccount = c6;
      currentPurpose = c11;
      currentBank = c19;
      continue;
    }
    // Subtotal/รวม row — skip
    if (c19.startsWith("รวม") || c19.startsWith("Page")) continue;
    // Data row: must have receipt_no and date
    if (!c4 || !/^[A-Z0-9]+-(RM|REC)/.test(c4)) continue;
    if (!/^\d{2}\/\d{2}\/\d{2,4}$/.test(c1)) continue;
    const amount = num(r[13]);
    const fee = num(r[14]);
    if (amount <= 0) continue;
    out.push({
      receipt_no: c4,
      transfer_date: thaiDateToIso(c1),
      bank_account_no: currentAccount,
      bank_name: currentBank,
      account_purpose: currentPurpose,
      amount,
      fee,
      branch: c25 || null,
      customer_name: c22 || null,
    });
  }
  return out;
}

/* -------------------- Extractor for EX format (48 cols) -------------------- */
function extractDailyReceipts(rows, sourceFile) {
  if (rows.length < 2) return [];
  // First row is header — skip
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const receiptNo = (r[0] || "").trim();
    if (!receiptNo) continue;
    const type = (r[3] || "").trim();
    out.push({
      receipt_no: receiptNo,
      receipt_date: dateOnly(r[1]),
      receipt_datetime: dateTime(r[2]),
      receipt_type: type || null,
      vat_rate: num(r[4]),
      amount_before_vat: num(r[5]),
      vat_amount: num(r[6]),
      total_amount: num(r[7]),
      status: (r[8] || "").trim() || "ปกติ",
      cash: num(r[9]),
      transfer: num(r[10]),
      cheque: num(r[11]),
      bank_fee: num(r[12]),
      deposit: num(r[13]),
      credit_card: num(r[14]),
      credit_note: num(r[15]),
      wht: num(r[16]),
      smartpurse: num(r[17]),
      coupon: num(r[18]),
      round_up: num(r[19]),
      round_down: num(r[20]),
      qr_credit: num(r[23]),
      qr_cash: num(r[24]),
      customer_name: (r[30] || "").trim() || null,
      cashier: (r[31] || "").trim() || null,
      sale_invoice_no: (r[32] || "").trim() || null,
      ref_doc_type: (r[34] || "").trim() || null,
      receipt_tax_invoice_no: (r[36] || "").trim() || null,
      customer_in_invoice: (r[39] || "").trim() || null,
      customer_tax_id: (r[40] || "").trim() || null,
      note: (r[41] || "").trim() || null,
      branch_code: getBranchFromReceipt(receiptNo),
    });
  }
  return out;
}

/* ============================== Page ============================== */
export default function DailyReceiptUploadPage({ currentUser, embeddable = false }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  // Transfer file (เงินโอนแยกตามบัญชี)
  const [tFile, setTFile] = useState(null);
  const [tPreview, setTPreview] = useState([]);
  const [tParsing, setTParsing] = useState(false);
  const [tUploading, setTUploading] = useState(false);
  const [tMsg, setTMsg] = useState("");

  async function previewTransferFile() {
    setTMsg("");
    setTPreview([]);
    if (!tFile) { setTMsg("⚠️ เลือกไฟล์ก่อน"); return; }
    setTParsing(true);
    try {
      const rows = await readCsvFile(tFile);
      const data = extractReceiptTransfers(rows, tFile.name);
      setTPreview(data);
      const banks = [...new Set(data.map(d => `${d.bank_name} (${d.bank_account_no})`).filter(Boolean))];
      const total = data.reduce((s, d) => s + Number(d.amount || 0), 0);
      setTMsg(`✅ อ่าน ${data.length} รายการโอน · รวม ${total.toLocaleString("th-TH")} · ${banks.length} บัญชี`);
    } catch (e) {
      setTMsg("❌ อ่านล้มเหลว: " + e.message);
    }
    setTParsing(false);
  }

  async function uploadTransferFile() {
    if (tPreview.length === 0) { setTMsg("⚠️ กดอ่านไฟล์ก่อน"); return; }
    setTUploading(true);
    setTMsg("");
    try {
      const res = await fetch(TRANSFER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_receipt_transfers",
          transfers: tPreview,
          source_file: tFile?.name || "",
          uploaded_by: currentUser?.user_id || currentUser?.name || "",
        }),
      });
      const data = await res.json();
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) setTMsg("❌ " + (ok?.error || "บันทึกล้มเหลว"));
      else {
        setTMsg(`✅ บันทึกสำเร็จ ${ok?.upserted || tPreview.length} รายการ`);
        setTPreview([]);
        setTFile(null);
      }
    } catch (e) {
      setTMsg("❌ " + e.message);
    }
    setTUploading(false);
  }

  async function handlePreview() {
    setMessage("");
    setPreview([]);
    if (!file) { setMessage("⚠️ เลือกไฟล์ก่อน"); return; }
    setParsing(true);
    try {
      const rows = await readCsvFile(file);
      const data = extractDailyReceipts(rows, file.name);
      setPreview(data);
      // Stats
      const branches = [...new Set(data.map(d => d.branch_code).filter(Boolean))];
      const types = [...new Set(data.map(d => d.receipt_type).filter(Boolean))];
      const total = data.reduce((s, d) => s + Number(d.total_amount || 0), 0);
      setMessage(`✅ อ่าน ${data.length} ใบเสร็จ · ยอดรวม ${total.toLocaleString("th-TH")} · สาขา: ${branches.join(", ")} · ประเภท: ${types.join(", ")}`);
    } catch (e) {
      setMessage("❌ อ่านล้มเหลว: " + e.message);
    }
    setParsing(false);
  }

  async function handleUpload() {
    if (preview.length === 0) { setMessage("⚠️ กดอ่านไฟล์ก่อน"); return; }
    setUploading(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_daily_receipts",
          receipts: preview,
          source_file: file?.name || "",
          uploaded_by: currentUser?.user_id || currentUser?.name || "",
        }),
      });
      const data = await res.json();
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) {
        setMessage("❌ " + (ok?.error || "บันทึกล้มเหลว"));
      } else {
        setMessage(`✅ บันทึกสำเร็จ ${ok?.upserted || preview.length} ใบเสร็จ`);
        setPreview([]);
        setFile(null);
      }
    } catch (e) {
      setMessage("❌ " + e.message);
    }
    setUploading(false);
  }

  const inner = (
    <>
      {/* Section 1: ใบเสร็จรายวัน (EX) */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📥 ไฟล์ที่ 1 — ใบเสร็จรายวัน (EX)</div>
        <div style={{ padding: "10px 14px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "#92400e" }}>
          📋 <strong>รายงานสรุปรายวันรับเงิน-EX</strong> — UTF-8 BOM, 48 คอลัมน์ — เลขใบเสร็จ (RM) → ใบขาย (SS) → ใบกำกับภาษี
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <input type="file" accept=".csv" onChange={e => { setFile(e.target.files?.[0] || null); setPreview([]); setMessage(""); }}
            style={{ flex: "0 0 auto" }} />
          {file && <span style={{ fontSize: 12, color: "#6b7280" }}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>}
          <div style={{ flex: 1 }} />
          <button onClick={handlePreview} disabled={parsing || !file}
            style={{ padding: "8px 18px", background: parsing ? "#9ca3af" : "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: parsing || !file ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            {parsing ? "📖 อ่าน..." : "📖 อ่านไฟล์"}
          </button>
          <button onClick={handleUpload} disabled={uploading || preview.length === 0}
            style={{ padding: "8px 22px", background: uploading || preview.length === 0 ? "#9ca3af" : "#15803d", color: "#fff", border: "none", borderRadius: 6, cursor: uploading || preview.length === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}>
            {uploading ? "💾 ..." : `💾 Upload ${preview.length || ""} ใบเสร็จ`}
          </button>
        </div>

        {message && (
          <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13,
            background: message.startsWith("✅") ? "#f0fdf4" : message.startsWith("❌") ? "#fef2f2" : "#fffbeb",
            color: message.startsWith("✅") ? "#15803d" : message.startsWith("❌") ? "#b91c1c" : "#92400e" }}>
            {message}
          </div>
        )}
      </div>

      {/* Section 2: เงินโอนแยกตามบัญชี */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>🏦 ไฟล์ที่ 2 — เงินโอนแยกตามบัญชี</div>
        <div style={{ padding: "10px 14px", background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "#1e40af" }}>
          📋 <strong>รายงานสรุปรายวันรับเงินโอนแยกตามบัญชี</strong> — UTF-8 BOM, 26 คอลัมน์ — แสดงว่าเงินโอนแต่ละใบเสร็จเข้าบัญชีไหน
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <input type="file" accept=".csv" onChange={e => { setTFile(e.target.files?.[0] || null); setTPreview([]); setTMsg(""); }}
            style={{ flex: "0 0 auto" }} />
          {tFile && <span style={{ fontSize: 12, color: "#6b7280" }}>{tFile.name} ({(tFile.size / 1024).toFixed(1)} KB)</span>}
          <div style={{ flex: 1 }} />
          <button onClick={previewTransferFile} disabled={tParsing || !tFile}
            style={{ padding: "8px 18px", background: tParsing ? "#9ca3af" : "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: tParsing || !tFile ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            {tParsing ? "📖 อ่าน..." : "📖 อ่านไฟล์"}
          </button>
          <button onClick={uploadTransferFile} disabled={tUploading || tPreview.length === 0}
            style={{ padding: "8px 22px", background: tUploading || tPreview.length === 0 ? "#9ca3af" : "#15803d", color: "#fff", border: "none", borderRadius: 6, cursor: tUploading || tPreview.length === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}>
            {tUploading ? "💾 ..." : `💾 Upload ${tPreview.length || ""} รายการ`}
          </button>
        </div>

        {tMsg && (
          <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13,
            background: tMsg.startsWith("✅") ? "#f0fdf4" : tMsg.startsWith("❌") ? "#fef2f2" : "#fffbeb",
            color: tMsg.startsWith("✅") ? "#15803d" : tMsg.startsWith("❌") ? "#b91c1c" : "#92400e" }}>
            {tMsg}
          </div>
        )}

        {tPreview.length > 0 && (
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>เลขที่ใบเสร็จ</th>
                  <th>ลูกค้า</th>
                  <th>บัญชี</th>
                  <th>ชื่อบัญชี</th>
                  <th style={{ textAlign: "right" }}>จำนวน</th>
                  <th style={{ textAlign: "right" }}>Fee</th>
                </tr>
              </thead>
              <tbody>
                {tPreview.slice(0, 10).map((t, i) => (
                  <tr key={i}>
                    <td>{t.transfer_date || "-"}</td>
                    <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{t.receipt_no}</td>
                    <td>{t.customer_name || "-"}</td>
                    <td style={{ fontFamily: "monospace", color: "#0369a1" }}>{t.bank_account_no || "-"}</td>
                    <td style={{ fontSize: 11 }}>{t.bank_name || "-"}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#15803d" }}>{t.amount?.toLocaleString() || "-"}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{t.fee ? t.fee.toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
          <h3 style={{ margin: "0 0 12px", color: "#072d6b", fontSize: 15 }}>
            🔍 พรีวิว (10 แถวแรก) — รวม {preview.length} ใบเสร็จ
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
              <thead>
                <tr>
                  <th>สาขา</th>
                  <th>เลขที่ใบเสร็จ</th>
                  <th>วันที่</th>
                  <th>ประเภท</th>
                  <th>ลูกค้า</th>
                  <th>เลขที่ใบขาย</th>
                  <th style={{ textAlign: "right" }}>เงินสด</th>
                  <th style={{ textAlign: "right" }}>เงินโอน</th>
                  <th style={{ textAlign: "right" }}>มัดจำ</th>
                  <th style={{ textAlign: "right" }}>รวม</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td><span style={{ display: "inline-block", padding: "2px 8px", background: "#dbeafe", color: "#1e40af", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{r.branch_code || "-"}</span></td>
                    <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.receipt_no}</td>
                    <td>{r.receipt_date || "-"}</td>
                    <td style={{ fontSize: 11 }}>{r.receipt_type || "-"}</td>
                    <td>{r.customer_name || "-"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{r.sale_invoice_no || "-"}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{r.cash ? r.cash.toLocaleString() : "-"}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{r.transfer ? r.transfer.toLocaleString() : "-"}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{r.deposit ? r.deposit.toLocaleString() : "-"}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#15803d" }}>{r.total_amount?.toLocaleString() || "-"}</td>
                    <td>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: r.status === "ปกติ" ? "#dcfce7" : "#fee2e2",
                        color: r.status === "ปกติ" ? "#065f46" : "#991b1b" }}>{r.status}</span>
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
        <div className="page-title">📥 อัพโหลดใบเสร็จรายวัน (EX)</div>
      </div>
      {inner}
    </div>
  );
}
