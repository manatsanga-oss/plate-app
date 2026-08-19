import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// รายงานรับชำระเงินรายคัน NEW (Report Admin) — ใช้ข้อมูลจากระบบทั้งหมด
// ใบขาย + การรับชำระจาก retail_sales (บันทึกขาย NEW / ขายปลีก) เริ่มเดือน ส.ค. 2569
// ไม่เกี่ยวกับข้อมูล upload DMS (รายงานรายคันตัวเดิมดูฝั่ง upload)
// ============================================================================
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";

const START_DEFAULT = "2026-08-01"; // เริ่มใช้รายงาน = ขายตั้งแต่เดือน 8 ปี 69

const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
const baht = (v) => num(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function CarPaymentReportNewPage() {
  const [dateFrom, setDateFrom] = useState(START_DEFAULT);
  const [dateTo, setDateTo] = useState(todayISO());
  const [branch, setBranch] = useState("");
  const [kw, setKw] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all | full | over | partial
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null); // แถวที่กดดูวิธีชำระ

  async function load() {
    setLoading(true); setMessage("");
    try {
      const r = await fetch(RETAIL_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_retail_sales", date_from: dateFrom, date_to: dateTo, limit: 2000 }),
      });
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || !data.length) setMessage("ไม่พบใบขายในช่วงวันที่ที่เลือก");
    } catch (e) {
      setRows([]); setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const branchOpts = useMemo(() => [...new Set(rows.map(r => (r.branch_code || "").split(/\s+/)[0]).filter(Boolean))].sort(), [rows]);

  // ยอดขายทั้งคัน — รับชำระได้หลายแหล่ง + หลายครั้ง:
  //   1) หน้าร้าน (retail_sales: เงินสด/โอน/มัดจำ/รถเทิร์น ฯลฯ)
  //   2) ตัดรับเงินโอนไฟแนนท์ FT (ระบบบันทึกรับชำระไฟแนนท์ — ตัดสะสมได้หลายรอบ ใน ft_vehicle_paid)
  //   3) เงินดาวน์/ค่างวดออกแทน (ของแถมร้านออกให้ = ถือว่าเคลียร์ยอดส่วนนั้นแล้ว)
  const saleTotal = (r) => num(r.net_car_price || r.car_price);
  const storePaid = (r) => (r.payment_status === "paid" ? num(r.paid_amount) : 0);
  const depositOf = (r) => num(r.booking_deposit);          // เงินมัดจำจอง — ลูกค้าจ่ายไว้ตอนจอง หักจากยอดเก็บหน้าร้านแล้ว
  const ftPaid = (r) => num(r.ft_vehicle_paid);
  // ประกันรถหาย — นับเป็นแหล่งแยกเฉพาะ "ไฟแนนซ์หัก/โปรโมชั่นออกแทน" (หักจากยอดโอน FT)
  // ถ้า source = finance คือลูกค้าจ่ายเบี้ยเองหน้าร้าน รวมอยู่ใน paid_amount แล้ว — ห้ามนับซ้ำ
  const theftOf = (r) => {
    const s = String(r.theft_insurance_source || "");
    return (s === "ไฟแนนซ์หัก" || s === "โปรโมชั่นออกแทน") ? num(r.theft_insurance_amount) : 0;
  };
  const payoutOf = (r) => num(r.down_payout_amount) + theftOf(r);
  const receivedOf = (r) => storePaid(r) + depositOf(r) + ftPaid(r) + payoutOf(r);
  const statusOf = (r) => {
    const total = saleTotal(r), got = receivedOf(r);
    if (got > total + 0.009) return "over";
    if (got >= total - 0.009 && total > 0) return "full";
    return "partial";
  };
  const payMethods = (r) => {
    const pm = r.payment_methods;
    if (Array.isArray(pm)) return pm;
    if (typeof pm === "string" && pm.trim()) { try { return JSON.parse(pm); } catch { return []; } }
    return [];
  };

  const kwU = kw.trim().toUpperCase();
  const filtered = rows.filter(r => {
    if (branch && (r.branch_code || "").split(/\s+/)[0] !== branch) return false;
    if (statusTab !== "all" && statusOf(r) !== statusTab) return false;
    if (!kwU) return true;
    return [r.invoice_no, r.customer_name, r.chassis_no, r.engine_no, r.receipt_no, r.finance_company_name, r.model_code, r.model_name]
      .some(v => String(v || "").toUpperCase().includes(kwU));
  });

  const counts = useMemo(() => {
    const c = { all: rows.length, full: 0, over: 0, partial: 0 };
    rows.forEach(r => { c[statusOf(r)] += 1; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const sumSale = filtered.reduce((s, r) => s + saleTotal(r), 0);
  const sumReceived = filtered.reduce((s, r) => s + receivedOf(r), 0);

  function exportCSV() {
    const head = ["สาขา", "เลขใบขาย", "วันที่ขาย", "ลูกค้า", "ไฟแนนท์", "เลขเครื่อง", "เลขตัวถัง", "รุ่น", "สี", "ยอดขายทั้งคัน", "รับหน้าร้าน", "มัดจำจอง", "รับไฟแนนท์ FT", "ออกแทน/ไฟแนนซ์หัก", "คงเหลือ", "เลขใบเสร็จ", "วันที่รับชำระ", "วิธีชำระหน้าร้าน", "สถานะ"];
    const lines = filtered.map(r => {
      const methods = payMethods(r).map(p => `${p.method} ${baht(p.amount)}`).join(" | ");
      const st = statusOf(r);
      const total = saleTotal(r), store = storePaid(r), dep = depositOf(r), ft = ftPaid(r), payout = payoutOf(r);
      return [
        (r.branch_code || "").split(/\s+/)[0], r.invoice_no, thDate(r.sale_date), r.customer_name || "",
        r.finance_company_name || "", r.engine_no || "", r.chassis_no || "",
        r.model_name || r.model_code || "", r.model_color || "",
        total, store, dep, ft, payout, Math.max(0, total - store - dep - ft - payout),
        r.receipt_no || "", r.receipt_date ? thDate(r.receipt_date) : "", methods,
        st === "full" ? "ครบ" : st === "over" ? "ชำระเกิน" : "ไม่ครบ",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = "﻿" + [head.join(","), ...lines].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `car_payment_new_${dateFrom}_${dateTo}.csv`;
    a.click();
  }

  const chip = (key, label, color, bg) => (
    <button key={key} onClick={() => setStatusTab(key)}
      style={{ padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700,
        background: statusTab === key ? color : bg, color: statusTab === key ? "#fff" : color }}>
      {label} ({counts[key]})
    </button>
  );

  return (
    <div style={{ padding: 4, fontFamily: "Tahoma" }}>
      <h2 style={{ marginTop: 0 }}>🧾 รายงานรับชำระเงินรายคัน NEW <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>— ใบขาย + รับชำระจากระบบทั้งหมด (เริ่ม ส.ค. 69)</span></h2>

      {/* ตัวกรอง */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 13 }}>ตั้งแต่: <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} /></label>
        <label style={{ fontSize: 13 }}>ถึง: <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} /></label>
        <select value={branch} onChange={e => setBranch(e.target.value)} style={inp}>
          <option value="">ทุกสาขา</option>
          {branchOpts.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input value={kw} onChange={e => setKw(e.target.value)} placeholder="🔍 ค้นหา (ใบขาย / ลูกค้า / เลขเครื่อง / เลขถัง / ใบเสร็จ / ไฟแนนท์)"
          style={{ ...inp, flex: 1, minWidth: 220 }} />
        <button onClick={load} disabled={loading} style={btn("#2563eb")}>{loading ? "โหลด…" : "🔍 ค้นหา"}</button>
        <button onClick={exportCSV} style={btn("#16a34a")}>📥 Export CSV</button>
      </div>

      {/* สถานะ */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {chip("all", "ทั้งหมด", "#334155", "#e2e8f0")}
        {chip("full", "✅ ครบ", "#047857", "#d1fae5")}
        {chip("over", "🟠 ชำระเกิน", "#b45309", "#fef3c7")}
        {chip("partial", "🔴 ไม่ครบ", "#b91c1c", "#fee2e2")}
      </div>

      {/* สรุป */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 14 }}>
        <SummaryCard label={`📋 รวม ${filtered.length} คัน (ยอดขายทั้งคัน)`} value={baht(sumSale)} color="#1d4ed8" bg="#dbeafe" />
        <SummaryCard label="💰 รับแล้วทุกแหล่ง (หน้าร้าน + FT + ออกแทน)" value={baht(sumReceived)} color="#7c3aed" bg="#ede9fe" />
        <SummaryCard label={`🔴 คงเหลือ (${filtered.filter(r => statusOf(r) === "partial").length} คัน)`} value={baht(Math.max(0, sumSale - sumReceived))} color="#b91c1c" bg="#fee2e2" />
      </div>

      {message && <div style={{ color: "#b45309", marginBottom: 10 }}>{message}</div>}

      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              {["#", "สาขา", "เลขใบขาย", "วันที่ขาย", "ลูกค้า / ไฟแนนท์", "เลขเครื่อง", "รุ่น / สี", "ยอดขาย", "รับหน้าร้าน", "รับไฟแนนท์ (FT)", "ออกแทน", "คงเหลือ", "ใบเสร็จ", "สถานะ"].map(h => (
                <th key={h} style={{ ...th, textAlign: ["ยอดขาย", "รับหน้าร้าน", "รับไฟแนนท์ (FT)", "ออกแทน", "คงเหลือ"].includes(h) ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const st = statusOf(r);
              const total = saleTotal(r), store = storePaid(r) + depositOf(r), ft = ftPaid(r), payout = payoutOf(r);
              const remain = Math.max(0, total - store - ft - payout);
              return (
                <tr key={r.invoice_no || i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                  <td style={td}>{(r.branch_code || "").split(/\s+/)[0] || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8", whiteSpace: "nowrap" }}>{r.invoice_no}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thDate(r.sale_date)}</td>
                  <td style={td}>
                    {r.customer_name || "-"}
                    {r.finance_company_name && <div style={{ fontSize: 11, color: "#7c3aed" }}>🏦 {r.finance_company_name}</div>}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no || "-"}</td>
                  <td style={td}>{r.model_name || r.model_code || "-"}{r.model_color ? <div style={{ fontSize: 11, color: "#6b7280" }}>สี {r.model_color}</div> : null}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#1d4ed8" }}>{baht(total)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {store > 0 ? (<>
                      <span onClick={() => setDetail(r)} style={{ color: "#7c3aed", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} title="ดูวิธีชำระหน้าร้าน">
                        {baht(store)}
                      </span>
                      {depositOf(r) > 0 && <div style={{ fontSize: 11, color: "#6b7280" }}>รวมมัดจำจอง {baht(depositOf(r))}</div>}
                    </>) : "-"}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {ft > 0 ? (<>
                      <span style={{ color: "#0369a1", fontWeight: 700 }}>{baht(ft)}</span>
                      {r.ft_paid_at && <div style={{ fontSize: 11, color: "#6b7280" }}>{thDate(r.ft_paid_at)}</div>}
                    </>) : (r.finance_company_name ? <span style={{ color: "#b45309", fontSize: 11 }}>รอตัดรับ</span> : "-")}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "#b45309" }}>
                    {payout > 0 ? (<>
                      {baht(payout)}
                      {theftOf(r) > 0 && <div style={{ fontSize: 11, color: "#6b7280" }}>ประกันรถหาย {baht(theftOf(r))}</div>}
                    </>) : "-"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: remain > 0.009 ? "#b91c1c" : "#047857" }}>{baht(remain)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {r.receipt_no ? (<>
                      <span style={{ fontFamily: "monospace" }}>{r.receipt_no}</span>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{thDate(r.receipt_date)}</div>
                    </>) : "-"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {st === "full" && <span style={pill("#047857", "#d1fae5")}>✅ ครบ</span>}
                    {st === "over" && <span style={pill("#b45309", "#fef3c7")}>ชำระเกิน</span>}
                    {st === "partial" && <span style={pill("#b91c1c", "#fee2e2")}>ไม่ครบ</span>}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && !loading && (
              <tr><td colSpan={14} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 24 }}>ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* popup วิธีชำระ */}
      {detail && (
        <div onClick={() => setDetail(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 480, fontFamily: "Tahoma" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>💳 วิธีรับชำระ — {detail.invoice_no}</div>
              <button onClick={() => setDetail(null)} style={{ border: "none", background: "#f3f4f6", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>ปิด</button>
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
              {detail.customer_name} · ใบเสร็จ {detail.receipt_no || "-"} · {thDate(detail.receipt_date)}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <tbody>
                {payMethods(detail).map((p, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 6px" }}>{p.method}{p.account_name ? <span style={{ fontSize: 11, color: "#6b7280" }}> · {p.account_name}</span> : ""}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>{baht(p.amount)}</td>
                  </tr>
                ))}
                {num(detail.booking_deposit) > 0 && (
                  <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 6px" }}>เงินมัดจำจอง (จ่ายไว้ตอนจอง)</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>{baht(detail.booking_deposit)}</td>
                  </tr>
                )}
                {theftOf(detail) > 0 && (
                  <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 6px" }}>ประกันรถหาย ({detail.theft_insurance_source || "ไฟแนนซ์หักจากยอดโอน"})</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#b45309" }}>{baht(theftOf(detail))}</td>
                  </tr>
                )}
                {num(detail.theft_insurance_amount) > 0 && theftOf(detail) === 0 && (
                  <tr><td colSpan={2} style={{ padding: "6px", fontSize: 12, color: "#6b7280" }}>
                    ℹ️ ประกันรถหาย {baht(detail.theft_insurance_amount)} ลูกค้าจ่ายเองหน้าร้าน — รวมอยู่ในยอดรับหน้าร้านแล้ว
                  </td></tr>
                )}
                {num(detail.ft_vehicle_paid) > 0 && (
                  <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 6px" }}>ตัดรับเงินโอนไฟแนนท์ (FT)
                      <span style={{ fontSize: 11, color: "#6b7280" }}> · ใบกำกับ {detail.ft_invoice_no || "-"}{detail.ft_paid_at ? ` · ${thDate(detail.ft_paid_at)}` : ""}</span>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#0369a1" }}>{baht(detail.ft_vehicle_paid)}</td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #e5e7eb", background: "#fefce8" }}>
                  <td style={{ padding: "8px 6px", fontWeight: 700 }}>รวมรับทุกแหล่ง</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>{baht(num(detail.paid_amount) + num(detail.booking_deposit) + num(detail.ft_vehicle_paid) + num(detail.down_payout_amount) + theftOf(detail))}</td>
                </tr>
                {num(detail.down_payout_amount) > 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: "8px 6px", fontSize: 12, color: "#b45309" }}>
                      🎁 เงินดาวน์/ค่างวดออกแทน (ของแถมร้านออกให้): {baht(detail.down_payout_amount)} — นับรวมใน "รวมรับทุกแหล่ง" แล้ว
                    </td>
                  </tr>
                )}
                {detail.payment_received_note && (
                  <tr><td colSpan={2} style={{ padding: "8px 6px", fontSize: 12, color: "#6b7280" }}>หมายเหตุ: {detail.payment_received_note}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 13.5, color, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>฿ {value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", fontSize: 13.5, border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", background: "#fff" };
const btn = (bg) => ({ padding: "8px 16px", fontSize: 13.5, fontWeight: 700, color: "#fff", background: bg, border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" });
const th = { padding: "9px 10px", fontSize: 12.5, whiteSpace: "nowrap" };
const td = { padding: "8px 10px", verticalAlign: "top" };
const pill = (color, bg) => ({ padding: "3px 10px", borderRadius: 14, fontSize: 12, fontWeight: 700, color, background: bg, whiteSpace: "nowrap" });
