import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้า "รายงานงบทดลอง" (Trial Balance) — แบบ 6 ช่อง รายเดือน
// ----------------------------------------------------------------------------
// แต่ละหมวด (เงินสด / เงินฝากธนาคาร / ลูกหนี้) แสดง 6 ช่อง:
//   ยอดยกมา (DR/CR) · ระหว่างงวด (DR/CR) · ยอดยกไป (DR/CR)
// ตารางหลักโชว์ยอดรวมหมวด → คลิกเปิด popup ดูรายละเอียดรายตัว (lazy)
//
// คิดยอดแบบเดียวกับหน้า "ความเคลื่อนไหวธนาคาร":
//   เงินสด/ธนาคาร: opening = opening_balance + Σ movements ก่อนต้นเดือน,
//                  ระหว่างงวด DR = รับเข้าในเดือน, CR = จ่ายออกในเดือน, closing = opening+DR−CR
//   ลูกหนี้ (ค่ารถ): บักเกตตามวันที่ขาย — ยกมา=ขายก่อนเดือน, ระหว่างงวด(DR)=ขายในเดือน, ยกไป=คงเหลือถึงสิ้นเดือน
// แหล่งข้อมูล: accounting-api (list_bank_accounts / list_bank_movements / list_car_payment_receipts)
// ============================================================================
const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const REPORT_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-report-api";

const CASH_TYPES = ["เงินสดย่อย"];
const BANK_TYPES = ["ออมทรัพย์", "กระแสรายวัน", "ฝากประจำ"];
const AR_CUTOFF_ISO = "2026-05-01"; // ขายก่อนวันนี้ = ข้อมูลเก่า ถือว่าชำระครบ ไม่นับเป็นลูกหนี้

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function curYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthRange(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  const start = `${ym}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(last).padStart(2, "0")}`;
  return { start, end };
}
function ymLabelTH(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return ym;
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}
function fmtN(n) {
  const v = Number(n || 0);
  return v === 0 ? "-" : v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateTH(iso) {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}` : "-";
}
const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

async function postAcc(body) {
  // list_car_payment_receipts ย้ายไป workflow ใหม่ Accounting Report API
  const url = body?.action === "list_car_payment_receipts" ? REPORT_URL : ACCOUNTING_URL;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}
const asArray = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);

// แตกยอดเป็น DR/CR ของสินทรัพย์: ยอดบวก→DR, ยอดลบ→CR
const drcr = (bal) => ({ dr: bal >= 0 ? r2(bal) : 0, cr: bal < 0 ? r2(-bal) : 0 });

export default function TrialBalanceReportPage() {
  const [ym, setYm] = useState(curYM());
  const [loadedYm, setLoadedYm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  // รายการรายตัวต่อหมวด: { account_id, name, sub, opening, periodDr, periodCr, closing }
  const [cashRows, setCashRows] = useState([]);
  const [bankRows, setBankRows] = useState([]);
  // ลูกหนี้รายคัน (สำหรับ popup) + ยอดสรุป
  const [arRows, setArRows] = useState([]); // { customer, doc, sale, opening, periodDr, closing }
  const [popup, setPopup] = useState(null); // null | "cash" | "bank" | "ar"

  async function loadReport(targetYm = ym) {
    setLoading(true);
    setMessage("");
    const { start, end } = monthRange(targetYm);
    try {
      // ---------- เงินสด + เงินฝากธนาคาร ----------
      const accs = asArray(await postAcc({ action: "list_bank_accounts", include_inactive: "false" }))
        .filter((a) => {
          const t = String(a.account_type || "").trim();
          return CASH_TYPES.includes(t) || BANK_TYPES.includes(t);
        });

      const accComputed = await Promise.all(accs.map(async (a) => {
        const type = String(a.account_type || "").trim();
        const group = CASH_TYPES.includes(type) ? "cash" : "bank";
        let mv = [];
        try {
          mv = asArray(await postAcc({ action: "list_bank_movements", account_id: Number(a.account_id), date_from: "2000-01-01", date_to: end }));
        } catch { /* ไม่มี movements → ใช้ยอดยกมาอย่างเดียว */ }
        const opening0 = Number(a.opening_balance || 0);
        let preSum = 0, periodDr = 0, periodCr = 0;
        mv.forEach((m) => {
          const d = String(m.movement_date || "").slice(0, 10);
          const amt = Number(m.amount || 0);
          if (d < start) { preSum += amt; }
          else if (d <= end) {
            if (m.direction === "in") periodDr += amt;
            else periodCr += Math.abs(amt);
          }
        });
        const opening = r2(opening0 + preSum);
        const closing = r2(opening + periodDr - periodCr);
        return {
          group,
          account_id: a.account_id,
          name: a.account_name,
          sub: [a.bank_name && a.bank_name !== "-" ? a.bank_name : "", a.account_no && a.account_no !== "-" ? a.account_no : ""].filter(Boolean).join(" · "),
          opening, periodDr: r2(periodDr), periodCr: r2(periodCr), closing,
        };
      }));
      accComputed.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "th"));
      setCashRows(accComputed.filter((x) => x.group === "cash"));
      setBankRows(accComputed.filter((x) => x.group === "bank"));

      // ---------- ลูกหนี้ค้างชำระค่ารถ (บักเกตตามวันที่ขาย) ----------
      try {
        const cpr = asArray(await postAcc({ action: "list_car_payment_receipts", date_from: "2000-01-01", date_to: end }));
        const ftPaid = (r) => (r.paid_vehicle_price != null ? Number(r.paid_vehicle_price) : Number(r.paid_from_amount || 0));
        const ar = [];
        cpr.forEach((r) => {
          const sd = String(r.sale_date || r.invoice_date || "").slice(0, 10);
          if (sd && sd < AR_CUTOFF_ISO) return; // ขายก่อน 1 พ.ค. 2569 → ถือว่าชำระครบ
          const rem = Number(r.total_amount || 0) - (Number(r.total_paid || 0) + ftPaid(r));
          if (rem <= 0.01) return;
          ar.push({
            customer: r.sale_customer_name || r.customer_name || "-",
            doc: r.tax_invoice_no || r.sale_invoice_no || "",
            sale_invoice_no: r.sale_invoice_no || "",
            finance: r.sale_finance_company || "",
            sale_date: sd,
            inMonth: sd >= start && sd <= end,
            beforeMonth: sd < start,
            remaining: r2(rem),
          });
        });
        ar.sort((a, b) => b.remaining - a.remaining);
        setArRows(ar);
      } catch { setArRows([]); }

      setLoadedYm(targetYm);
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + (e.message || e));
      setCashRows([]); setBankRows([]); setArRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { loadReport(); /* eslint-disable-next-line */ }, []);

  // ---------- สรุป 6 ช่องต่อหมวด ----------
  // เงินสด/ธนาคาร: รวม DR/CR ของแต่ละช่วงจากรายบัญชี
  const aggAcc = (rows) => {
    const o = { openDr: 0, openCr: 0, perDr: 0, perCr: 0, closeDr: 0, closeCr: 0 };
    rows.forEach((r) => {
      const op = drcr(r.opening), cl = drcr(r.closing);
      o.openDr += op.dr; o.openCr += op.cr;
      o.perDr += r.periodDr; o.perCr += r.periodCr;
      o.closeDr += cl.dr; o.closeCr += cl.cr;
    });
    return o;
  };
  const cashAgg = useMemo(() => aggAcc(cashRows), [cashRows]);
  const bankAgg = useMemo(() => aggAcc(bankRows), [bankRows]);
  // ลูกหนี้ (สินทรัพย์ ยอดเป็น DR): ยกมา=ขายก่อนเดือน, ระหว่างงวด DR=ขายในเดือน, ยกไป=รวม
  const arAgg = useMemo(() => {
    const opening = arRows.filter((r) => r.beforeMonth).reduce((s, r) => s + r.remaining, 0);
    const perDr = arRows.filter((r) => r.inMonth).reduce((s, r) => s + r.remaining, 0);
    const closing = arRows.reduce((s, r) => s + r.remaining, 0);
    return { openDr: r2(opening), openCr: 0, perDr: r2(perDr), perCr: 0, closeDr: r2(closing), closeCr: 0 };
  }, [arRows]);

  const groups = [
    { key: "cash", label: "เงินสด", color: "#065f46", count: cashRows.length, agg: cashAgg, has: cashRows.length > 0 },
    { key: "bank", label: "เงินฝากธนาคาร", color: "#1e40af", count: bankRows.length, agg: bankAgg, has: bankRows.length > 0 },
    { key: "ar", label: "ลูกหนี้การค้า (ค้างชำระค่ารถ)", color: "#991b1b", count: arRows.length, agg: arAgg, has: arRows.length > 0 },
  ];
  const tot = groups.reduce((o, g) => ({
    openDr: o.openDr + g.agg.openDr, openCr: o.openCr + g.agg.openCr,
    perDr: o.perDr + g.agg.perDr, perCr: o.perCr + g.agg.perCr,
    closeDr: o.closeDr + g.agg.closeDr, closeCr: o.closeCr + g.agg.closeCr,
  }), { openDr: 0, openCr: 0, perDr: 0, perCr: 0, closeDr: 0, closeCr: 0 });

  const hasData = cashRows.length + bankRows.length + arRows.length > 0;

  return (
    <div className="page-container">
      <style>{`
        @media print {
          .no-print, .no-print * { display: none !important; }
          .sidebar, aside.sidebar, .page-topbar { display: none !important; }
          body, html, #root, .page-container { background:#fff !important; margin:0 !important; padding:0 !important; }
          .tb6 { font-size:11px !important; } .tb6 th, .tb6 td { padding:3px 5px !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <div className="page-topbar">
        <div className="page-title">📋 รายงานงบทดลอง (รายเดือน)</div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>📅 เดือน</label>
            <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} style={{ ...inp, minWidth: 160 }} />
          </div>
          <button onClick={() => loadReport()} disabled={loading}
            style={{ padding: "8px 18px", background: loading ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            🔄 {loading ? "กำลังคิดยอด..." : "ดูรายงาน"}
          </button>
          <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 420 }}>
            ยอดยกมา = สิ้นเดือนก่อน · ระหว่างงวด = ในเดือน · ยอดยกไป = สิ้นเดือน — คลิกที่หมวดเพื่อดูรายละเอียด
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={() => window.print()} disabled={loading || !hasData}
              style={{ padding: "8px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🖨️ พิมพ์</button>
          </div>
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
      </div>

      {/* Report */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#072d6b" }}>งบทดลอง</div>
          <div style={{ fontSize: 13, color: "#374151" }}>หมวดเงินสด เงินฝากธนาคาร และลูกหนี้</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>ประจำเดือน {ymLabelTH(loadedYm || ym)}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังคิดยอด...</div>
        ) : !hasData ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tb6" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#072d6b", color: "#fff" }}>
                  <th style={{ ...th, width: 34 }} rowSpan={2}>#</th>
                  <th style={{ ...th, textAlign: "left" }} rowSpan={2}>หมวดบัญชี</th>
                  <th style={{ ...th, borderLeft: "1px solid #2b4a86" }} colSpan={2}>ยอดยกมา</th>
                  <th style={{ ...th, borderLeft: "1px solid #2b4a86" }} colSpan={2}>ระหว่างงวด</th>
                  <th style={{ ...th, borderLeft: "1px solid #2b4a86" }} colSpan={2}>ยอดยกไป</th>
                </tr>
                <tr style={{ background: "#0a3a82", color: "#fff" }}>
                  {["เดบิต", "เครดิต", "เดบิต", "เครดิต", "เดบิต", "เครดิต"].map((h, i) => (
                    <th key={i} style={{ ...th, fontSize: 11, borderLeft: i % 2 === 0 ? "1px solid #2b4a86" : "none" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g, i) => (
                  <tr key={g.key}
                    onClick={() => g.has && setPopup(g.key)}
                    title={g.has ? "คลิกดูรายละเอียด" : ""}
                    style={{ borderBottom: "1px solid #e5e7eb", cursor: g.has ? "pointer" : "default" }}
                    onMouseEnter={(e) => g.has && (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      <span style={{ color: g.color }}>{g.label}</span>
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#6b7280" }}>({g.count})</span>
                      {g.has && <span className="no-print" style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#2563eb" }}>🔍</span>}
                    </td>
                    <td style={tdNum}>{fmtN(g.agg.openDr)}</td>
                    <td style={{ ...tdNum, color: g.agg.openCr ? "#dc2626" : undefined }}>{fmtN(g.agg.openCr)}</td>
                    <td style={{ ...tdNum, color: g.agg.perDr ? "#047857" : undefined }}>{fmtN(g.agg.perDr)}</td>
                    <td style={{ ...tdNum, color: g.agg.perCr ? "#dc2626" : undefined }}>{fmtN(g.agg.perCr)}</td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{fmtN(g.agg.closeDr)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: g.agg.closeCr ? "#dc2626" : undefined }}>{fmtN(g.agg.closeCr)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b", borderTop: "2px solid #072d6b" }}>
                  <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวมทั้งสิ้น</td>
                  <td style={tdNum}>{fmtN(tot.openDr)}</td>
                  <td style={tdNum}>{fmtN(tot.openCr)}</td>
                  <td style={tdNum}>{fmtN(tot.perDr)}</td>
                  <td style={tdNum}>{fmtN(tot.perCr)}</td>
                  <td style={tdNum}>{fmtN(tot.closeDr)}</td>
                  <td style={tdNum}>{fmtN(tot.closeCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="no-print" style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
          * เงินสด/ธนาคารคิดแบบเดียวกับหน้า "ความเคลื่อนไหวธนาคาร" · ลูกหนี้บักเกตตามวันที่ขาย (รถขายก่อน 1 พ.ค. 2569 ถือว่าชำระครบ) — หมวดอื่นจะทยอยเพิ่มภายหลัง
        </div>
      </div>

      {popup && (
        <DetailModal
          popup={popup}
          ym={loadedYm || ym}
          cashRows={cashRows}
          bankRows={bankRows}
          arRows={arRows}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

// ===================== Popup รายละเอียดรายตัว =====================
function DetailModal({ popup, ym, cashRows, bankRows, arRows, onClose }) {
  const isAr = popup === "ar";
  const title = popup === "cash" ? "💵 เงินสด" : popup === "bank" ? "🏦 เงินฝากธนาคาร" : "🧾 ลูกหนี้การค้า (ค้างชำระค่ารถ)";
  const accRows = popup === "cash" ? cashRows : bankRows;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(920px, 97vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b" }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ประจำเดือน {ym}</div>
        <div style={{ overflowX: "auto" }}>
          {isAr ? <ArDetailTable rows={arRows} /> : <AccDetailTable rows={accRows} />}
        </div>
      </div>
    </div>
  );
}

function AccDetailTable({ rows }) {
  const sum = rows.reduce((o, r) => {
    const op = drcr(r.opening), cl = drcr(r.closing);
    return { openDr: o.openDr + op.dr, openCr: o.openCr + op.cr, perDr: o.perDr + r.periodDr, perCr: o.perCr + r.periodCr, closeDr: o.closeDr + cl.dr, closeCr: o.closeCr + cl.cr };
  }, { openDr: 0, openCr: 0, perDr: 0, perCr: 0, closeDr: 0, closeCr: 0 });
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ background: "#072d6b", color: "#fff" }}>
          <th style={{ ...th, width: 30 }} rowSpan={2}>#</th>
          <th style={{ ...th, textAlign: "left" }} rowSpan={2}>บัญชี</th>
          <th style={th} colSpan={2}>ยอดยกมา</th>
          <th style={th} colSpan={2}>ระหว่างงวด</th>
          <th style={th} colSpan={2}>ยอดยกไป</th>
        </tr>
        <tr style={{ background: "#0a3a82", color: "#fff" }}>
          {["DR", "CR", "DR", "CR", "DR", "CR"].map((h, i) => <th key={i} style={{ ...th, fontSize: 11 }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const op = drcr(r.opening), cl = drcr(r.closing);
          return (
            <tr key={r.account_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
              <td style={td}>{r.name}{r.sub ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.sub}</div> : null}</td>
              <td style={tdNum}>{fmtN(op.dr)}</td>
              <td style={{ ...tdNum, color: op.cr ? "#dc2626" : undefined }}>{fmtN(op.cr)}</td>
              <td style={{ ...tdNum, color: r.periodDr ? "#047857" : undefined }}>{fmtN(r.periodDr)}</td>
              <td style={{ ...tdNum, color: r.periodCr ? "#dc2626" : undefined }}>{fmtN(r.periodCr)}</td>
              <td style={{ ...tdNum, fontWeight: 600 }}>{fmtN(cl.dr)}</td>
              <td style={{ ...tdNum, fontWeight: 600, color: cl.cr ? "#dc2626" : undefined }}>{fmtN(cl.cr)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b" }}>
          <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวม</td>
          <td style={tdNum}>{fmtN(sum.openDr)}</td><td style={tdNum}>{fmtN(sum.openCr)}</td>
          <td style={tdNum}>{fmtN(sum.perDr)}</td><td style={tdNum}>{fmtN(sum.perCr)}</td>
          <td style={tdNum}>{fmtN(sum.closeDr)}</td><td style={tdNum}>{fmtN(sum.closeCr)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function ArDetailTable({ rows }) {
  const total = rows.reduce((s, r) => s + Number(r.remaining || 0), 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ background: "#072d6b", color: "#fff" }}>
          <th style={{ ...th, width: 30 }}>#</th>
          <th style={{ ...th, textAlign: "left" }}>ลูกค้า</th>
          <th style={{ ...th, textAlign: "left" }}>เลขที่ใบกำกับ / ใบขาย</th>
          <th style={{ ...th, textAlign: "center" }}>วันที่ขาย</th>
          <th style={{ ...th, textAlign: "center" }}>งวด</th>
          <th style={{ ...th, textAlign: "right" }}>ยอดค้าง</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
            <td style={td}>{r.customer}{r.finance ? <div style={{ fontSize: 11, color: "#6b7280" }}>📋 {r.finance}</div> : null}</td>
            <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.doc || "-"}{r.sale_invoice_no && r.sale_invoice_no !== r.doc ? <div style={{ color: "#0369a1" }}>{r.sale_invoice_no}</div> : null}</td>
            <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{fmtDateTH(r.sale_date)}</td>
            <td style={{ ...td, textAlign: "center" }}>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: r.inMonth ? "#dcfce7" : "#e5e7eb", color: r.inMonth ? "#166534" : "#6b7280" }}>
                {r.inMonth ? "ในเดือน" : "ยกมา"}
              </span>
            </td>
            <td style={{ ...tdNum, color: "#991b1b" }}>{fmtN(r.remaining)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b" }}>
          <td colSpan={5} style={{ ...td, textAlign: "right" }}>รวม {rows.length} คัน</td>
          <td style={{ ...tdNum, color: "#991b1b" }}>{fmtN(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 };
const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const th = { padding: "7px 9px", textAlign: "center", fontWeight: 600 };
const td = { padding: "6px 9px", verticalAlign: "top" };
const tdNum = { padding: "6px 9px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };
