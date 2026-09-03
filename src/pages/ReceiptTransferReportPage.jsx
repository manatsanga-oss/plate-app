import React, { useEffect, useState } from "react";

// รายงานสรุปรับชำระเงิน (มัดจำ) — user 2026-09-03 (เดิมเป็นเงินโอน)
// ดึงเฉพาะใบเสร็จรับเงินที่มีการชำระด้วย "เงินมัดจำ" (daily_receipts.deposit > 0) จากไฟล์ที่ upload
const RECEIPTS_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-daily-receipts";
// เลขที่ใบมัดจำที่ถูกตัดในแต่ละใบเสร็จ — จากรายงานเงินมัดจำ NID (RECEIPT_PLEDGE) ที่นำเข้าไว้ (1 ใบเสร็จมีได้หลายใบมัดจำ)
const NID_DEP_API = "https://n8n-new-project-gwf2.onrender.com/webhook/nid-deposit-api";
const BRANCHES = ["SCY01", "SCY04", "SCY05", "SCY06", "SCY07"];

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

export default function ReceiptTransferReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [depMap, setDepMap] = useState({}); // receipt_no → [{deposit_no, used_amount, ...}]

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      // n8n ตอบ body ว่างเมื่อไม่มีข้อมูล → อ่านเป็น text ก่อนค่อย parse (กัน "Unexpected end of JSON input")
      const one = async (branch) => {
        const res = await fetch(RECEIPTS_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_daily_receipts", date_from: dateFrom, date_to: dateTo, branch_code: branch }),
        });
        const t = await res.text();
        if (!t.trim()) return [];
        try { const d = JSON.parse(t); return Array.isArray(d) ? d : (d?.rows || []); } catch { return []; }
      };
      const all = (await Promise.all(BRANCHES.map(one))).flat();
      // เฉพาะใบที่ชำระด้วยเงินมัดจำ (ช่องเงินมัดจำ > 0)
      const dep = all.filter((r) => r && r.receipt_no && num(r.deposit) > 0)
        .sort((a, b) => String(b.receipt_date || "").localeCompare(String(a.receipt_date || "")) || String(a.receipt_no).localeCompare(String(b.receipt_no)));
      setRows(dep);
      if (!dep.length) setMessage("ไม่พบใบเสร็จที่ชำระด้วยเงินมัดจำในช่วงวันที่นี้ (ข้อมูลมาจากไฟล์ใบเสร็จที่ upload — ตรวจว่าอัปโหลดรอบล่าสุดแล้ว)");
      // จับคู่เลขที่ใบมัดจำที่ถูกตัดในแต่ละใบเสร็จ
      setDepMap({});
      if (dep.length) {
        try {
          const r2 = await fetch(NID_DEP_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list_usages", receipt_nos: dep.map((x) => x.receipt_no) }),
          });
          const t2 = await r2.text();
          const d2 = t2.trim() ? JSON.parse(t2) : {};
          const list = typeof d2?.listjson === "string" ? JSON.parse(d2.listjson) : Array.isArray(d2) ? d2 : [];
          const m = {};
          list.forEach((u) => {
            if (!u || !u.used_receipt_no) return;
            (m[u.used_receipt_no] = m[u.used_receipt_no] || []).push(u);
          });
          setDepMap(m);
        } catch { /* ยังไม่ได้ import workflow nid-deposit-api → คอลัมน์ใบมัดจำว่าง */ }
      }
    } catch (e) {
      setRows([]); setMessage("❌ โหลดไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const bc5 = (v) => String(v || "").substring(0, 5).toUpperCase();
  const branches = [...new Set(rows.map((r) => bc5(r.branch_code)).filter(Boolean))].sort();
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (branchFilter !== "all" && bc5(r.branch_code) !== branchFilter) return false;
    if (!kw) return true;
    const hay = [r.receipt_no, r.customer_name, r.sale_invoice_no, r.receipt_type, r.note, r.cashier]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalDeposit = filtered.reduce((s, r) => s + num(r.deposit), 0);
  const totalReceipt = filtered.reduce((s, r) => s + num(r.total_amount), 0);
  // group by branch
  const byBranch = {};
  filtered.forEach((r) => {
    const k = bc5(r.branch_code) || "-";
    if (!byBranch[k]) byBranch[k] = { branch: k, total: 0, count: 0 };
    byBranch[k].total += num(r.deposit);
    byBranch[k].count += 1;
  });
  const branchSummary = Object.values(byBranch).sort((a, b) => b.total - a.total);

  function exportCSV() {
    const header = ["วันที่ใบเสร็จ", "เลขที่ใบเสร็จ", "สาขา", "ลูกค้า", "ประเภทใบเสร็จ", "เลขที่เอกสารอ้างอิง", "ยอดรวมใบเสร็จ", "ชำระด้วยมัดจำ", "เลขที่ใบมัดจำ", "ผู้รับเงิน", "สถานะ", "หมายเหตุ"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      lines.push([fmtDate(r.receipt_date), r.receipt_no, bc5(r.branch_code), r.customer_name, r.receipt_type, r.sale_invoice_no,
        num(r.total_amount), num(r.deposit),
        (depMap[r.receipt_no] || []).map((u) => `${u.deposit_no} ${u.used_amount != null ? u.used_amount : u.deposit_amount}`).join(" / "),
        r.cashier, r.status, r.note]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `receipt_deposit_${dateFrom}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 18, maxWidth: 1500, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>📊 รายงานสรุปรับชำระเงิน (มัดจำ)</h2>
      <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>
        เฉพาะใบเสร็จรับเงินที่มีการชำระด้วย <b>เงินมัดจำ</b> (ตัดจากใบรับมัดจำ) — ข้อมูลจากไฟล์ใบเสร็จรายวันที่อัปโหลด
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 10, background: "#f1f5f9", borderRadius: 8, marginBottom: 12 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc" }} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc" }} />
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc" }}>
          <option value="all">ทุกสาขา</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input type="text" placeholder="🔍 ค้นหา…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc", minWidth: 220 }} />
        <button onClick={fetchData} disabled={loading} style={{ padding: "6px 14px", background: "#2563eb", color: "white", borderRadius: 4, border: "none", cursor: "pointer" }}>
          {loading ? "กำลังโหลด…" : "🔍 ค้นหา"}
        </button>
        <button onClick={exportCSV} style={{ padding: "6px 14px", background: "#10b981", color: "white", borderRadius: 4, border: "none", cursor: "pointer" }}>
          📁 Export CSV
        </button>
      </div>

      {message && <div style={{ padding: 8, marginBottom: 8, color: message.startsWith("❌") ? "#b91c1c" : "#b45309" }}>{message}</div>}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <div style={cardStyle("#dbeafe", "#1e40af")}>
          <div style={{ fontSize: 11 }}>🧾 จำนวนใบเสร็จที่ใช้มัดจำ</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{filtered.length}</div>
        </div>
        <div style={cardStyle("#f3e8ff", "#6b21a8")}>
          <div style={{ fontSize: 11 }}>🪙 ยอดที่ชำระด้วยมัดจำ</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(totalDeposit)}</div>
        </div>
        <div style={cardStyle("#dcfce7", "#166534")}>
          <div style={{ fontSize: 11 }}>💰 ยอดรวมใบเสร็จทั้งหมด</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(totalReceipt)}</div>
        </div>
        <div style={cardStyle("#fef9c3", "#854d0e")}>
          <div style={{ fontSize: 11 }}>🏢 จำนวนสาขา</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{branchSummary.length}</div>
        </div>
      </div>

      {/* Branch summary */}
      {branchSummary.length > 0 && (
        <div style={{ marginBottom: 14, padding: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#072d6b" }}>สรุปยอดชำระด้วยมัดจำแยกตามสาขา</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#f0f4f9" }}>
              <th style={th}>#</th><th style={th}>สาขา</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวนใบเสร็จ</th><th style={{ ...th, textAlign: "right" }}>ยอดมัดจำที่ใช้</th>
            </tr></thead>
            <tbody>
              {branchSummary.map((b, i) => (
                <tr key={i}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{b.branch}</td>
                  <td style={{ ...td, textAlign: "right" }}>{b.count}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail table */}
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f0f4f9" }}>
            <th style={th}>#</th><th style={th}>วันที่ใบเสร็จ</th><th style={th}>เลขที่ใบเสร็จ</th><th style={th}>สาขา</th>
            <th style={th}>ลูกค้า</th><th style={th}>ประเภทใบเสร็จ</th><th style={th}>เอกสารอ้างอิง</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดรวมใบเสร็จ</th>
            <th style={{ ...th, textAlign: "right" }}>ชำระด้วยมัดจำ</th>
            <th style={th}>เลขที่ใบมัดจำ (ตัดจาก)</th>
            <th style={th}>ผู้รับเงิน</th><th style={th}>หมายเหตุ</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={12} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>{loading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}</td></tr>}
            {filtered.map((r, i) => (
              <tr key={r.receipt_no + i} style={{ background: String(r.status || "") === "ยกเลิก" ? "#fef2f2" : undefined }}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{fmtDate(r.receipt_date)}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{r.receipt_no || "-"}
                  {String(r.status || "") === "ยกเลิก" && <div style={{ fontSize: 10.5, color: "#b91c1c" }}>ยกเลิก</div>}
                </td>
                <td style={td}>{bc5(r.branch_code) || "-"}</td>
                <td style={td}>{r.customer_name || "-"}</td>
                <td style={{ ...td, fontSize: 12 }}>{r.receipt_type || "-"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.sale_invoice_no || "-"}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmt(r.total_amount)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#7c3aed" }}>{fmt(r.deposit)}</td>
                <td style={{ ...td, fontSize: 12 }}>
                  {(depMap[r.receipt_no] || []).length === 0 ? <span style={{ color: "#9ca3af" }}>-</span> : (depMap[r.receipt_no] || []).map((u, k) => (
                    <div key={k} style={{ whiteSpace: "nowrap" }}>
                      <span style={{ fontFamily: "monospace", color: "#7c3aed", fontWeight: 600 }}>{u.deposit_no}</span>
                      <span style={{ color: "#374151" }}> · {u.used_amount != null ? fmt(u.used_amount) : fmt(u.deposit_amount)}</span>
                      {u.group_size > 1 && <span style={{ color: "#b45309" }}> (รวมกลุ่ม {u.group_size} ใบ)</span>}
                      {u.deposit_type ? <div style={{ color: "#94a3b8", fontSize: 11 }}>{u.deposit_type} · รับ {fmtDate(u.deposit_date)}</div> : null}
                    </div>
                  ))}
                </td>
                <td style={{ ...td, fontSize: 12 }}>{r.cashier || "-"}</td>
                <td style={{ ...td, fontSize: 12 }}>{r.note || "-"}</td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                <td colSpan={7} style={{ ...td, textAlign: "right" }}>รวมทั้งสิ้น</td>
                <td style={{ ...td, textAlign: "right" }}>{fmt(totalReceipt)}</td>
                <td style={{ ...td, textAlign: "right", color: "#7c3aed" }}>{fmt(totalDeposit)}</td>
                <td colSpan={3} style={td}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { border: "1px solid #ddd", padding: "6px 8px", textAlign: "left", fontWeight: 600 };
const td = { border: "1px solid #ddd", padding: "5px 8px" };
function cardStyle(bg, color) {
  return { padding: 10, background: bg, color, borderRadius: 6 };
}
