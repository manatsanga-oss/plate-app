import React, { useState } from "react";

// ฟีเจอร์: upload ใบเพิ่มหนี้ขายรถ (debit note) จากรายงาน DMS "รายงานการออกใบเพิ่มหนี้" (MCR06130)
// - ไฟล์ .XLS: หัวตารางแถวที่คอลัมน์แรก = "วันที่" · 1 รายการกินหลายแถว (วันที่/เลขที่อยู่คนละแถวกับยอด) → forward-fill
// - parse ฝั่ง client → webhook flow-input-tax-api (action upload_debit_notes) — UPSERT (branch, debit_note_no)
// - ยอดเข้า "รายงานภาษีขาย" เป็นแหล่ง "ใบเพิ่มหนี้" (เพิ่มยอดขาย/ภาษีขายของงวดตามวันที่ใบเพิ่มหนี้)
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/flow-input-tax-api";

const BRANCHES = [
  { value: "PAPAO", label: "ป.เปา" },
  { value: "NAKORNLUANG", label: "นครหลวง" },
  { value: "SINGCHAI", label: "สิงห์ชัย" },
];

function thaiDateToIso(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
// งวดภาษีแบบ list_tax_invoices = ปี พ.ศ.+เดือน เช่น '256906'
function isoToBuddhistYm(iso) {
  if (!iso) return null;
  const [y, m] = iso.split("-");
  return `${Number(y) + 543}${m}`;
}
function num(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
const txt = (v) => String(v == null ? "" : v).trim();

export default function VehicleDebitNoteUploadCard({ currentUser }) {
  const [branch, setBranch] = useState("PAPAO");
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleParse(theFile) {
    setMsg(""); setRows([]);
    const f = theFile || file;
    if (!f) { setMsg("⚠️ เลือกไฟล์ก่อน"); return; }
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

      // หาแถวหัวตาราง (คอลัมน์แรก = "วันที่")
      let hi = grid.findIndex(r => txt(r[0]) === "วันที่");
      if (hi < 0) throw new Error('ไม่พบหัวตาราง "วันที่" — ตรวจว่าเป็นไฟล์รายงานการออกใบเพิ่มหนี้ (MCR06130)');

      // Crystal Report บีบค่าชิดซ้าย: 1 รายการกิน 3 แถว — แถววันที่ (col0) → แถวเลขที่ใบเพิ่มหนี้ (col0)
      // → แถวยอด (col0=ลูกค้า, col1=อ้างถึงใบกำกับ, col2–6=มูลค่าเดิม/ที่ถูกต้อง/ผลต่าง/VAT/ก่อนVAT)
      const out = [];
      let curDate = "", curNo = "";
      for (let i = hi + 1; i < grid.length; i++) {
        const r = grid[i] || [];
        const c0 = txt(r[0]);
        if (c0.startsWith("ยอดรวม") || r.map(txt).join(" ").includes("จบรายงาน")) continue;
        const restEmpty = r.slice(1).every(v => !txt(v));
        if (restEmpty) {
          if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c0)) { curDate = c0; continue; }
          if (c0.includes("/")) { curNo = c0; continue; }
          continue;
        }
        // แถวยอด
        const ref = txt(r[1]);
        const diff = num(r[4]);
        if (!curNo || (!ref && !diff)) continue;
        // ลูกค้า "6905-000171 - MR. SAW AUNG" → แยกรหัส/ชื่อ
        const cm = c0.match(/^(\S+)\s*-\s*(.+)$/);
        const iso = thaiDateToIso(curDate);
        out.push({
          debit_note_no: curNo,
          debit_note_date: iso,
          invoice_year_month: isoToBuddhistYm(iso),
          customer_code: cm ? cm[1] : null,
          customer_name: cm ? cm[2].trim() : (c0 || null),
          ref_tax_invoice_no: ref || null,
          original_amount: num(r[2]),
          corrected_amount: num(r[3]),
          difference_amount: diff,
          vat_amount: num(r[5]),
          amount_before_vat: num(r[6]),
        });
        curDate = ""; curNo = "";            // จบรายการนี้ กัน carry ไปใบถัดไปผิด ๆ
      }
      if (!out.length) throw new Error("ไม่พบรายการใบเพิ่มหนี้ในไฟล์");
      setRows(out);
      const sb = out.reduce((s, r) => s + r.amount_before_vat, 0);
      const sv = out.reduce((s, r) => s + r.vat_amount, 0);
      setMsg(`อ่านได้ ${out.length} ใบ · มูลค่าก่อน VAT ${sb.toLocaleString("th-TH", { minimumFractionDigits: 2 })} · VAT ${sv.toLocaleString("th-TH", { minimumFractionDigits: 2 })} — กด Upload เพื่อนำเข้า`);
    } catch (e) {
      setMsg("❌ อ่านไฟล์ไม่สำเร็จ: " + e.message);
    }
    setBusy(false);
  }

  async function handleUpload() {
    if (!rows.length) { setMsg("⚠️ ยังไม่มีรายการ — เลือกไฟล์ก่อน"); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_debit_notes", branch,
          uploaded_by: currentUser?.name || "ผู้ดูแลระบบ",
          source_file: file?.name || "", rows,
        }),
      });
      const t = (await res.text()).trim();
      let d = null; try { d = JSON.parse(t); } catch { /* body ว่าง = n8n ไม่ตอบ */ }
      const row0 = Array.isArray(d) ? d[0] : d;
      if (row0 && (row0.result === "ok" || row0.total != null)) {
        setMsg(`✅ นำเข้าใบเพิ่มหนี้สำเร็จ ${row0.total ?? rows.length} ใบ (${BRANCHES.find(b => b.value === branch)?.label})`);
        setRows([]); setFile(null);
      } else {
        setMsg("❌ นำเข้าไม่สำเร็จ: " + (row0?.error || t || "ไม่มีการตอบกลับจาก n8n (ตรวจว่า workflow Active)"));
      }
    } catch (e) { setMsg("❌ นำเข้าไม่สำเร็จ: " + e.message); }
    setBusy(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>🏢 สาขา:</label>
        <select value={branch} onChange={e => setBranch(e.target.value)}
          style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
          {BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <input type="file" accept=".xls,.xlsx"
          onChange={e => { const f = e.target.files?.[0] || null; setFile(f); if (f) handleParse(f); }}
          style={{ fontSize: 13 }} />
        <button onClick={handleUpload} disabled={busy || rows.length === 0}
          style={{ padding: "9px 22px", background: rows.length ? "#072d6b" : "#9ca3af", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: rows.length ? "pointer" : "not-allowed" }}>
          {busy ? "กำลังทำงาน..." : "Upload"}
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: msg.startsWith("❌") ? "#fee2e2" : msg.startsWith("✅") ? "#dcfce7" : "#fffbeb", color: msg.startsWith("❌") ? "#991b1b" : msg.startsWith("✅") ? "#166534" : "#92400e" }}>{msg}</div>
      )}
      {rows.length > 0 && (
        <table style={{ marginTop: 10, width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#f3f4f6", color: "#374151" }}>
              {["วันที่", "เลขที่ใบเพิ่มหนี้", "ลูกค้า", "อ้างถึงใบกำกับ", "มูลค่าเดิม", "ที่ถูกต้อง", "ผลต่าง", "VAT", "ก่อน VAT"].map(h => (
                <th key={h} style={{ padding: "6px 8px", border: "1px solid #e5e7eb", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{r.debit_note_date}</td>
                <td style={td}><b>{r.debit_note_no}</b></td>
                <td style={td}>{r.customer_name}</td>
                <td style={td}>{r.ref_tax_invoice_no}</td>
                <td style={tdR}>{r.original_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td style={tdR}>{r.corrected_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td style={tdR}>{r.difference_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td style={tdR}>{r.vat_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td style={tdR}>{r.amount_before_vat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const td = { padding: "6px 8px", border: "1px solid #e5e7eb" };
const tdR = { ...td, textAlign: "right" };
