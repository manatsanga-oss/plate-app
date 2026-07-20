import React, { useEffect, useMemo, useState } from "react";

// รายงานการเงินขายรถ — สรุปรายวันรับเงิน: ยอดขาย + เงินที่รับ + แหล่งรับชำระ (เงินสด/โอน/บัตร/ไฟแนนซ์/มัดจำ)
// ข้อมูล: retail-sale-api action list_sale_payments (ใบขายที่บันทึกรับชำระแล้ว กรองตามวันที่รับเงิน)
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";

const METHOD_COLS = [
  { key: "cash", label: "เงินสด" },
  { key: "transfer", label: "เงินโอน" },
  { key: "card", label: "บัตร/QR" },
  { key: "finance", label: "ไฟแนนซ์" },
  { key: "deposit", label: "เงินมัดจำ" },
  { key: "other", label: "อื่นๆ" },
];
function methodKey(name) {
  const n = String(name || "");
  if (n.includes("มัดจำ")) return "deposit";
  if (n.includes("สด")) return "cash";
  if (n.includes("โอน")) return "transfer";
  if (n.includes("บัตร") || n.toUpperCase().includes("QR")) return "card";
  if (n.includes("ไฟแนน")) return "finance";
  return "other";
}
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const fmt = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n) ? fmt(n) : "-");
const todayStr = () => new Date().toISOString().slice(0, 10);
const thaiDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function SaleMoneyReportPage({ currentUser }) {
  // user ทั่วไปเห็นเฉพาะสาขาตัวเอง — admin เลือกดูได้ทุกสาขา
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [branch, setBranch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(RETAIL_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_sale_payments", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json().catch(() => []);
      setRows(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) setMessage("ไม่พบรายการรับเงินในช่วงวันที่ที่เลือก");
    } catch {
      setRows([]);
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ (ตรวจสอบว่า workflow retail-sale-api ถูก re-import แล้ว)");
    }
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // pivot ช่องทางรับชำระของแต่ละใบ — user ทั่วไปกรองเหลือเฉพาะสาขาตัวเองเสมอ
  const items = useMemo(() => {
    return rows
      .filter((r) => (isAdmin ? !branch || r.branch_code === branch : String(r.branch_code || "").substring(0, 5).toUpperCase() === myBranch))
      .map((r) => {
        let pms = r.payment_methods;
        if (typeof pms === "string") { try { pms = JSON.parse(pms); } catch { pms = []; } }
        if (!Array.isArray(pms)) pms = [];
        const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, other: 0 };
        for (const p of pms) split[methodKey(p.method)] += num(p.amount);
        const received = num(r.paid_amount) || METHOD_COLS.reduce((s, c) => s + split[c.key], 0);
        return { ...r, split, received, saleAmount: num(r.net_car_price || r.car_price) };
      });
  }, [rows, branch, isAdmin, myBranch]);

  const branchOpts = useMemo(() => [...new Set(rows.map((r) => r.branch_code).filter(Boolean))].sort(), [rows]);

  // group ตามสาขา
  const groups = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const k = it.branch_code || "-";
      if (!m.has(k)) m.set(k, { key: k, name: it.branch_name || it.branch_code || "ไม่ระบุสาขา", rows: [] });
      m.get(k).rows.push(it);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [items]);

  const sumOf = (list) => {
    const t = { sale: 0, received: 0 };
    METHOD_COLS.forEach((c) => { t[c.key] = 0; });
    for (const it of list) {
      t.sale += it.saleAmount; t.received += it.received;
      METHOD_COLS.forEach((c) => { t[c.key] += it.split[c.key]; });
    }
    return t;
  };
  const grand = sumOf(items);

  const th = { padding: "6px 8px", fontSize: 12, whiteSpace: "nowrap", background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd", textAlign: "center" };
  const td = { padding: "5px 8px", fontSize: 12.5, border: "1px solid #e5e7eb", verticalAlign: "top" };
  const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };

  function printReport() {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    let body = "";
    let idx = 0;
    for (const g of groups) {
      body += `<tr><td colspan="13" class="grp">สาขา ${esc(g.name)}</td></tr>`;
      for (const it of g.rows) {
        idx++;
        body += `<tr>
<td class="c">${idx}</td><td>${esc(it.receipt_no || "-")}</td><td class="c">${esc(thaiDate(it.receipt_date || it.sale_date))}</td>
<td>${esc(it.sale_no)}</td><td>${esc(it.customer_name || "")}</td><td class="r">${fmt(it.saleAmount)}</td>
${METHOD_COLS.map((c) => `<td class="r">${it.split[c.key] ? fmt(it.split[c.key]) : "-"}</td>`).join("")}
<td class="r b">${fmt(it.received)}</td></tr>`;
      }
      const t = sumOf(g.rows);
      body += `<tr class="sub"><td colspan="5" class="r">รวมสาขา ${esc(g.name)} (${g.rows.length} รายการ)</td><td class="r">${fmt(t.sale)}</td>${METHOD_COLS.map((c) => `<td class="r">${t[c.key] ? fmt(t[c.key]) : "-"}</td>`).join("")}<td class="r b">${fmt(t.received)}</td></tr>`;
    }
    body += `<tr class="tot"><td colspan="5" class="r">รวมทั้งสิ้น (${items.length} รายการ)</td><td class="r">${fmt(grand.sale)}</td>${METHOD_COLS.map((c) => `<td class="r">${grand[c.key] ? fmt(grand[c.key]) : "-"}</td>`).join("")}<td class="r b">${fmt(grand.received)}</td></tr>`;

    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานการเงินขายรถ</title>
<style>@page{size:A4 landscape;margin:8mm}
*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}
body{margin:0;padding:10px;color:#222;font-size:12px}
h2{text-align:center;margin:0 0 2px;font-size:18px}
.sub-h{text-align:center;color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th{background:#eef6fb;border:1px solid #999;padding:4px 6px;font-size:11px}
td{border:1px solid #bbb;padding:3px 6px;font-size:11px}
.c{text-align:center}.r{text-align:right}.b{font-weight:700}
.grp{background:#f1f5f9;font-weight:700}
.sub td{background:#fafaf5;font-weight:700}
.tot td{background:#fde68a;font-weight:800;font-size:12px}
</style></head><body>
<h2>รายงานการเงินขายรถ — สรุปรายวันรับเงิน</h2>
<div class="sub-h">เลือกระหว่างวันที่ ${esc(thaiDate(dateFrom))} ถึง ${esc(thaiDate(dateTo))}${(isAdmin ? branch : myBranch) ? " · สาขา " + esc(isAdmin ? branch : myBranch) : ""} · พิมพ์เมื่อ ${esc(new Date().toLocaleString("th-TH"))}</div>
<table><thead><tr>
<th>ลำดับ</th><th>เลขที่ใบเสร็จ</th><th>วันที่รับเงิน</th><th>เลขที่ใบขาย</th><th>ลูกค้า</th><th>ยอดขาย</th>
${METHOD_COLS.map((c) => `<th>${c.label}</th>`).join("")}<th>รวมยอดชำระ</th>
</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  }

  const inp = { padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title">💰 รายงานการเงินขายรถ (สรุปรายวันรับเงิน)</h2>
        <button onClick={printReport} disabled={!items.length}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: items.length ? "#0369a1" : "#cbd5e1", color: "#fff", cursor: items.length ? "pointer" : "not-allowed", fontWeight: 600 }}>
          🖨️ พิมพ์รายงาน
        </button>
      </div>

      {/* filters */}
      <div className="form-card" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ตั้งแต่วันที่</div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ถึงวันที่</div>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>สาขา</div>
          {isAdmin ? (
            <select value={branch} onChange={(e) => setBranch(e.target.value)} style={inp}>
              <option value="">ทุกสาขา</option>
              {branchOpts.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          ) : (
            <div style={{ ...inp, background: "#f3f4f6", color: "#334155", fontWeight: 600 }} title="เห็นเฉพาะสาขาของตัวเอง">
              {myBranch || "—"}
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={load} disabled={loading}>{loading ? "⏳ กำลังโหลด..." : "🔍 แสดงรายงาน"}</button>
        {message && <span style={{ fontSize: 13, color: message.startsWith("❌") ? "#b91c1c" : "#92400e" }}>{message}</span>}
      </div>

      {/* summary cards */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
        <SummaryCard label="จำนวนรายการ" value={items.length.toLocaleString("th-TH")} color="#334155" />
        <SummaryCard label="ยอดขายรวม" value={fmt(grand.sale)} color="#0369a1" />
        <SummaryCard label="เงินรับรวม" value={fmt(grand.received)} color="#15803d" />
        {METHOD_COLS.filter((c) => grand[c.key] > 0).map((c) => (
          <SummaryCard key={c.key} label={c.label} value={fmt(grand[c.key])} color="#7c3aed" />
        ))}
      </div>

      {/* table */}
      <div className="form-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>ลำดับ</th><th style={th}>เลขที่ใบเสร็จ</th><th style={th}>วันที่รับเงิน</th>
            <th style={th}>เลขที่ใบขาย</th><th style={th}>ลูกค้า</th><th style={th}>ผู้ขาย</th><th style={th}>ยอดขาย</th>
            {METHOD_COLS.map((c) => <th key={c.key} style={th}>{c.label}</th>)}
            <th style={th}>รวมยอดชำระ</th>
          </tr></thead>
          <tbody>
            {groups.map((g) => {
              const t = sumOf(g.rows);
              return (
                <React.Fragment key={g.key}>
                  <tr><td colSpan={14} style={{ ...td, background: "#f1f5f9", fontWeight: 700, color: "#0f172a" }}>สาขา {g.name}</td></tr>
                  {g.rows.map((it, i) => (
                    <tr key={it.sale_no} style={{ background: i % 2 ? "#fafcff" : "#fff" }}>
                      <td style={{ ...td, textAlign: "center", color: "#94a3b8" }}>{i + 1}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{it.receipt_no || "-"}</td>
                      <td style={{ ...td, textAlign: "center" }}>{thaiDate(it.receipt_date || it.sale_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: "#1e40af" }}>{it.sale_no}</td>
                      <td style={td}>{it.customer_name || "-"}
                        {it.finance_type === "moto" && <div style={{ fontSize: 10.5, color: "#7c3aed" }}>ไฟแนนซ์: {it.finance_company_name || "-"}</div>}
                        {it.payment_received_note && <div style={{ fontSize: 10.5, color: "#92400e" }}>หมายเหตุ: {it.payment_received_note}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{it.seller || "-"}</td>
                      <td style={tdR}>{fmt(it.saleAmount)}</td>
                      {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(it.split[c.key])}</td>)}
                      <td style={{ ...tdR, fontWeight: 700, color: "#15803d" }}>{fmt(it.received)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fefce8", fontWeight: 700 }}>
                    <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวมสาขา {g.name} ({g.rows.length} รายการ)</td>
                    <td style={tdR}>{fmt(t.sale)}</td>
                    {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(t[c.key])}</td>)}
                    <td style={{ ...tdR, color: "#15803d" }}>{fmt(t.received)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
            {items.length > 0 && (
              <tr style={{ background: "#fde68a", fontWeight: 800 }}>
                <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวมทั้งสิ้น ({items.length} รายการ)</td>
                <td style={tdR}>{fmt(grand.sale)}</td>
                {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(grand[c.key])}</td>)}
                <td style={tdR}>{fmt(grand.received)}</td>
              </tr>
            )}
            {items.length === 0 && !loading && (
              <tr><td colSpan={14} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ไม่มีรายการรับเงินในช่วงที่เลือก —</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
        * แสดงเฉพาะใบขายที่บันทึกรับชำระเงินแล้ว (อ้างอิงวันที่รับเงิน/ใบเสร็จ) · ยอดขาย = ราคารถสุทธิ · แหล่งรับชำระแยกตามที่บันทึกตอนรับเงิน
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex: "1 1 130px", minWidth: 130, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
