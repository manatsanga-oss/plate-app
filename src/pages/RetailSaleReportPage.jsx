import React, { useEffect, useState } from "react";

const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const USED_MOTO_API = "https://n8n-new-project-gwf2.onrender.com/webhook/used-moto-api"; // ขายรถมือสอง (UM-) — รวมเข้ารายงานนี้ด้วย (user 2026-09-29)

const baht = (v) => {
  if (v === "" || v == null) return "-";
  const n = Number(v);
  return isFinite(n) ? n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
};
const fmtBE = (v) => {
  if (!v) return "-";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : String(v);
};

const FINANCE_LABEL = { none: "เงินสด", moto: "ไฟแนนซ์", moto_kit: "ไฟแนนซ์+ชุดแต่ง", full: "ไฟแนนซ์เต็ม" };

// วันที่ปัจจุบันตามเวลาเครื่อง (YYYY-MM-DD) — ห้ามใช้ toISOString ตรง ๆ เพราะเป็น UTC จะเพี้ยนข้ามวัน
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function RetailSaleReportPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ keyword: "", date_from: todayStr(), date_to: todayStr(), branch_code: "" });
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const r = await fetch(RETAIL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_retail_sales", ...filter, limit: 1000 }),
      });
      const data = await r.json();
      const newRows = Array.isArray(data) ? data : [];
      // ขายรถมือสอง (used-moto-api list_sales ตามวันที่ขาย) → แปลงให้หน้าตาเดียวกับใบขายปลีก + ธง is_used
      let usedRows = [];
      try {
        const ur = await fetch(USED_MOTO_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_sales", date_from: filter.date_from, date_to: filter.date_to }),
        });
        const ut = await ur.text();
        let ud = ut ? JSON.parse(ut) : [];
        if (ud && typeof ud.listjson === "string") ud = JSON.parse(ud.listjson);
        const kw = String(filter.keyword || "").trim().toLowerCase();
        const br = String(filter.branch_code || "").slice(0, 5).toUpperCase();
        usedRows = (Array.isArray(ud) ? ud : [])
          .filter((u) => u && String(u.status || "") === "sold")
          .filter((u) => !br || String(u.branch_code || "").slice(0, 5).toUpperCase() === br)
          .filter((u) => !kw || [u.doc_no, u.sold_invoice_no, u.sold_customer, u.sold_customer_phone, u.chassis_no, u.engine_no, u.license_plate].some((v) => String(v || "").toLowerCase().includes(kw)))
          .map((u) => ({
            is_used: true,
            invoice_no: u.sold_invoice_no || u.doc_no, used_doc_no: u.doc_no,
            sale_date: String(u.sold_date || u.sold_at || "").slice(0, 10),
            branch_code: u.branch_code || "",
            customer_name: u.sold_customer || "", customer_phone: u.sold_customer_phone || "", line_name: "",
            brand: u.brand || "", model_code: [u.model_series, u.model_code].filter(Boolean).join(" ") || "",
            chassis_no: u.chassis_no || "", engine_no: u.engine_no || "", license_plate: [u.license_plate, u.province].filter(Boolean).join(" "),
            car_price: u.sold_price, net_car_price: u.sold_price,
            finance_type: "none", finance_company_name: "", used_payment_method: u.payment_method || "",
            payment_status: "paid", total_payment: u.sold_price, tax_invoice_status: "", seller: u.sold_by || "",
          }));
      } catch { usedRows = []; }
      setRows([...newRows, ...usedRows].sort((a, b) => String(b.sale_date || "").localeCompare(String(a.sale_date || "")) || String(b.invoice_no || "").localeCompare(String(a.invoice_no || ""))));
    } catch (e) {
      setRows([]);
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // unique branches
  // ตัวเลือกสาขา: รวมตามรหัส 5 ตัวแรก (ใบขายรถใหม่เก็บ "SCY06 ป.เปา วังน้อย" ส่วนรถมือสองเก็บ "SCY06") ใช้ชื่อเต็มเป็นตัวแทน
  const branchOpts = Object.values(rows.reduce((m, r) => {
    const b = String(r.branch_code || "").trim(); if (!b) return m;
    const k = b.slice(0, 5).toUpperCase();
    if (!m[k] || b.length > m[k].length) m[k] = b;
    return m;
  }, {})).sort();

  // สถานะชำระ: ชำระแล้ว หรือ ไม่มียอดต้องชำระ (เช่น จัดไฟแนนท์เต็ม total_payment = 0) = "ชำระ"
  // มียอดต้องชำระแต่ยังไม่บันทึกรับชำระ = "ค้าง" (แถวเก่าที่ workflow ยังไม่ส่ง total_payment มา ใช้ payment_status ตามเดิม)
  const isPaidLike = (r) => r.payment_status === "paid" || (r.total_payment != null && Number(r.total_payment) <= 0);

  // summary
  const totalCarPrice = rows.reduce((s, r) => s + Number(r.net_car_price || r.car_price || 0), 0);
  const usedList = rows.filter((r) => r.is_used);
  const newList = rows.filter((r) => !r.is_used);
  const usedTotal = usedList.reduce((s, r) => s + Number(r.net_car_price || 0), 0);
  // เงินสด/ไฟแนนซ์ นับเฉพาะรถใหม่ (รถมือสองแยกการ์ดของตัวเอง)
  const cntCash = newList.filter((r) => r.finance_type === "none" || !r.finance_type).length;
  const cntFinance = newList.length - cntCash;

  // export CSV
  function exportCSV() {
    if (rows.length === 0) return;
    const header = ["ประเภท", "เลขที่ใบขาย", "วันที่", "สาขา", "ลูกค้า", "เบอร์", "ชื่อ LINE", "ยี่ห้อ", "รุ่น", "เลขถัง", "เลขเครื่อง", "ราคารถ", "ราคาสุทธิ", "การชำระ", "ไฟแนนซ์", "สถานะชำระ", "ใบกำกับภาษี", "ผู้ขาย"];
    const lines = rows.map((r) => [
      r.is_used ? "รถมือสอง" : "รถใหม่", r.invoice_no, r.sale_date, r.branch_code, r.customer_name, r.customer_phone, r.line_name || "",
      r.brand, r.model_code, r.chassis_no, r.engine_no,
      r.car_price, r.net_car_price,
      r.is_used ? (r.used_payment_method || "เงินสด") : (FINANCE_LABEL[r.finance_type] || r.finance_type || ""),
      r.finance_company_name || "",
      isPaidLike(r) ? (r.payment_status === "paid" ? "ชำระแล้ว" : "ไม่มียอดชำระ") : "ค้างชำระ",
      r.is_used ? "-" : (r.tax_invoice_status === "issued" ? "ออกแล้ว" : "ยังไม่ออก"),
      r.seller || "",
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = "﻿" + header.join(",") + "\n" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retail_sales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const card = { background: "#fff", padding: 16, borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
  const btn = { padding: "7px 14px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 };
  const btnPri = { ...btn, background: "#2563eb", color: "#fff" };
  const btnGreen = { ...btn, background: "#16a34a", color: "#fff" };
  const th = { padding: "8px 10px", background: "#f1f5f9", textAlign: "left", fontWeight: 700, fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0 };
  const td = { padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13 };

  return (
    <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: "#333" }}>📋 รายงานใบขายปลีก</h2>
        <button onClick={exportCSV} disabled={rows.length === 0} style={{ ...btnGreen, opacity: rows.length === 0 ? 0.5 : 1 }}>📊 Export CSV</button>
      </div>

      {message && <div style={{ padding: "8px 14px", marginBottom: 12, background: "#fee2e2", color: "#991b1b", borderRadius: 6, fontSize: 14 }}>{message}</div>}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, background: "#dbeafe" }}>
          <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 4 }}>📋 จำนวนใบขาย</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>{rows.length}</div>
          <div style={{ fontSize: 11, color: "#1e40af" }}>รถใหม่ {newList.length} · มือสอง {usedList.length}</div>
        </div>
        <div style={{ ...card, background: "#fef3c7" }}>
          <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>💰 มูลค่ารวม</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#78350f" }}>฿ {baht(totalCarPrice)}</div>
        </div>
        <div style={{ ...card, background: "#dcfce7" }}>
          <div style={{ fontSize: 12, color: "#065f46", marginBottom: 4 }}>💵 เงินสด (รถใหม่)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#14532d" }}>{cntCash} ใบ</div>
        </div>
        <div style={{ ...card, background: "#fce7f3" }}>
          <div style={{ fontSize: 12, color: "#9d174d", marginBottom: 4 }}>🏦 ไฟแนนซ์ (รถใหม่)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#831843" }}>{cntFinance} ใบ</div>
        </div>
        <div style={{ ...card, background: "#ffedd5" }}>
          <div style={{ fontSize: 12, color: "#9a3412", marginBottom: 4 }}>🛵 รถมือสอง</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#7c2d12" }}>{usedList.length} คัน</div>
          <div style={{ fontSize: 11, color: "#9a3412" }}>฿ {baht(usedTotal)}</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ ...card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input value={filter.keyword} onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="🔍 เลขที่ใบขาย / ลูกค้า / เลขถัง / เลขเครื่อง / ทะเบียน (มือสอง)"
          style={{ ...inp, minWidth: 260, flex: 1 }} />
        <input type="date" value={filter.date_from} onChange={(e) => setFilter({ ...filter, date_from: e.target.value })} style={inp} />
        <span style={{ fontSize: 13, color: "#64748b" }}>ถึง</span>
        <input type="date" value={filter.date_to} onChange={(e) => setFilter({ ...filter, date_to: e.target.value })} style={inp} />
        <select value={filter.branch_code} onChange={(e) => setFilter({ ...filter, branch_code: e.target.value })} style={inp}>
          <option value="">— ทุกสาขา —</option>
          {branchOpts.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={load} style={btnPri}>ค้นหา</button>
        <span style={{ fontSize: 13, color: "#64748b" }}>{rows.length} รายการ</span>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>เลขที่ใบขาย</th>
                <th style={th}>วันที่</th>
                <th style={th}>สาขา</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>เบอร์</th>
                <th style={th}>ชื่อ LINE</th>
                <th style={th}>รถ</th>
                <th style={th}>เลขถัง / เลขเครื่อง</th>
                <th style={{ ...th, textAlign: "right" }}>ราคาสุทธิ</th>
                <th style={th}>การชำระ</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 30 }}>กำลังโหลด...</td></tr>
                : rows.length === 0 ? <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 30 }}>ไม่มีข้อมูล</td></tr>
                : rows.map((r) => (
                  <tr key={(r.is_used ? "U:" : "N:") + (r.used_doc_no || r.invoice_no)} style={r.is_used ? { background: "#fff7ed" } : undefined}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: r.is_used ? "#c2410c" : "#0369a1" }}>
                      {r.invoice_no}
                      {r.is_used && <div><span style={{ fontFamily: "Tahoma", background: "#fed7aa", color: "#9a3412", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>🛵 รถมือสอง</span></div>}
                    </td>
                    <td style={td}>{fmtBE(r.sale_date)}</td>
                    <td style={td}><span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{r.branch_code || "-"}</span></td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.customer_phone || "-"}</td>
                    <td style={td}>{r.line_name ? <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>💬 {r.line_name}</span> : <span style={{ color: "#cbd5e1" }}>-</span>}</td>
                    <td style={td}>{[r.brand, r.model_code].filter(Boolean).join(" · ") || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>
                      {r.chassis_no || "-"}<br />
                      <span style={{ color: "#64748b" }}>{r.engine_no || "-"}</span>
                      {r.is_used && r.license_plate && <div style={{ fontFamily: "Tahoma", color: "#9a3412" }}>ทะเบียน {r.license_plate}</div>}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{baht(r.net_car_price || r.car_price)}</td>
                    <td style={td}>
                      <div>{r.is_used ? (r.used_payment_method || "เงินสด") : (FINANCE_LABEL[r.finance_type] || r.finance_type || "-")}</div>
                      {r.finance_company_name && <div style={{ fontSize: 11, color: "#64748b" }}>{r.finance_company_name}</div>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                        <span style={{ padding: "1px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: isPaidLike(r) ? "#dcfce7" : "#fef3c7", color: isPaidLike(r) ? "#15803d" : "#a16207" }}
                          title={isPaidLike(r) && r.payment_status !== "paid" ? "ไม่มียอดต้องชำระ (รวมยอดชำระ 0)" : ""}>
                          {isPaidLike(r) ? "✓ ชำระ" : "⏳ ค้าง"}
                        </span>
                        {!r.is_used && <span style={{ padding: "1px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: r.tax_invoice_status === "issued" ? "#dbeafe" : "#f3f4f6", color: r.tax_invoice_status === "issued" ? "#1e40af" : "#6b7280" }}>
                          {r.tax_invoice_status === "issued" ? "📄 ออกใบกำกับ" : "ยังไม่ออก"}
                        </span>}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
