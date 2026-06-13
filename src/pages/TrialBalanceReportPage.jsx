import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้า "รายงานงบทดลอง" (Trial Balance) — เฟส 1: เงินสด + เงินฝากธนาคาร
// ----------------------------------------------------------------------------
// ระบบไม่มีบัญชีแยกประเภท (GL) รวม — ยอดคงเหลือของแต่ละบัญชีคิดแบบ "เดียวกับหน้า
// ความเคลื่อนไหวธนาคาร" (BankMovementsPage):
//     ยอด ณ วันที่ = opening_balance + Σ(amount ของ movements ที่ ≤ วันที่)
// (amount เป็น NET หลังหัก WHT — รับเข้า = บวก, จ่ายออก = ลบ → ตรงกับหน้าธนาคารเป๊ะ)
//
// แหล่งข้อมูล: webhook เฉพาะ "trial-balance-api" (ไฟล์ Trial_Balance_API.json)
//   action get_trial_balance { as_of_date } → คิดยอดทุกบัญชีในครั้งเดียวฝั่ง server
//   (ใช้ SQL movements ชุดเดียวกับ list_bank_movements ครอบด้วย LATERAL ต่อบัญชี)
//   คืน array: { account_id, account_name, bank_name, account_no, account_type,
//               opening_balance, balance }  (เรียงเงินสดก่อน → ธนาคาร, ตามชื่อบัญชี)
// จัดกลุ่มงบทดลอง:
//   เงินสด          = account_type "เงินสดย่อย"
//   เงินฝากธนาคาร   = "ออมทรัพย์" / "กระแสรายวัน" / "ฝากประจำ"
// บัญชีสินทรัพย์ → ยอดบวกลงช่อง "เดบิต", ยอดติดลบ (เบิกเกินบัญชี) ลงช่อง "เครดิต"
// ============================================================================
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/trial-balance-api";
// ลูกหนี้การค้า (ค้างชำระค่ารถ) — ดึงจาก action เดียวกับหน้า "รายงานรับชำระเงินรายคัน"
const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const CASH_TYPES = ["เงินสดย่อย"];
const BANK_TYPES = ["ออมทรัพย์", "กระแสรายวัน", "ฝากประจำ"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtN(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTH(iso) {
  if (!iso) return "-";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}`;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}

const asArray = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);

export default function TrialBalanceReportPage({ currentUser }) {
  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [rows, setRows] = useState([]); // [{ account_id, account_name, account_no, bank_name, account_type, group, balance }]
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadedDate, setLoadedDate] = useState(""); // วันที่ของข้อมูลที่โหลดล่าสุด (ไว้โชว์หัวรายงาน)
  const [arDetail, setArDetail] = useState([]); // รายการลูกหนี้รายคัน (สำหรับ popup)
  const [popup, setPopup] = useState(null); // null | "cash" | "bank" | "ar" — หมวดที่เปิดดูรายละเอียด

  async function loadReport(date = asOfDate) {
    setLoading(true);
    setMessage("");
    try {
      // คิดยอดทุกบัญชี ณ วันที่ ในครั้งเดียวฝั่ง server (เลขตรงกับหน้าความเคลื่อนไหวธนาคาร)
      const data = asArray(await postJson(API_URL, { action: "get_trial_balance", as_of_date: date }));
      const computed = data.map((a) => {
        const type = String(a.account_type || "").trim();
        const group = CASH_TYPES.includes(type) ? "cash" : "bank"; // backend คืนเฉพาะเงินสด+ธนาคารแล้ว
        return {
          account_id: a.account_id,
          account_name: a.account_name,
          account_no: a.account_no && a.account_no !== "-" ? a.account_no : "",
          bank_name: a.bank_name && a.bank_name !== "-" ? a.bank_name : "",
          account_type: type,
          group,
          balance: Math.round((Number(a.balance || 0) + Number.EPSILON) * 100) / 100,
        };
      });
      // backend เรียงเงินสดก่อน → ธนาคาร ตามชื่อบัญชีมาแล้ว — กันเหนียวเรียงซ้ำฝั่ง client
      computed.sort((a, b) => {
        if (a.group !== b.group) return a.group === "cash" ? -1 : 1;
        return String(a.account_name || "").localeCompare(String(b.account_name || ""), "th");
      });

      // ----- ลูกหนี้การค้า (ค้างชำระค่ารถ) — ทุกใบที่ออกถึงวันที่เลือก -----
      // สูตรคงเหลือเดียวกับหน้า "รายงานรับชำระเงินรายคัน":
      //   คงเหลือ = Σ max(0, ยอดรวม − (รับชำระ daily + FT เฉพาะค่ารถ))
      try {
        const cpr = asArray(await postJson(ACCOUNTING_URL, {
          action: "list_car_payment_receipts", date_from: "2000-01-01", date_to: date,
        }));
        const ftPaid = (r) => (r.paid_vehicle_price != null ? Number(r.paid_vehicle_price) : Number(r.paid_from_amount || 0));
        // ขายก่อน 1 พ.ค. 2569 = ข้อมูลเก่า → ถือว่าชำระครบ ไม่นับเป็นลูกหนี้ (ตรงกับหน้ารับชำระเงินรายคัน)
        const isPreCutoff = (r) => { const d = String(r.sale_date || r.invoice_date || "").slice(0, 10); return d !== "" && d < "2026-05-01"; };
        const arRows = [];
        let receivable = 0;
        cpr.forEach((r) => {
          if (isPreCutoff(r)) return;
          const rem = Number(r.total_amount || 0) - (Number(r.total_paid || 0) + ftPaid(r));
          if (rem > 0.01) {
            receivable += rem;
            arRows.push({
              customer_name: r.sale_customer_name || r.customer_name || "-",
              tax_invoice_no: r.tax_invoice_no || "",
              sale_invoice_no: r.sale_invoice_no || "",
              sale_date: r.sale_date || r.invoice_date || "",
              model_name: r.model_name || "",
              engine_no: r.engine_no || "",
              finance: r.sale_finance_company || "",
              remaining: Math.round((rem + Number.EPSILON) * 100) / 100,
            });
          }
        });
        arRows.sort((a, b) => b.remaining - a.remaining);
        setArDetail(arRows);
        if (receivable > 0) {
          computed.push({
            account_id: "ar-car-payment",
            account_name: "ลูกหนี้การค้า — ค้างชำระค่ารถ",
            account_no: "",
            bank_name: `${arRows.length} คัน`,
            account_type: "ลูกหนี้",
            group: "ar",
            balance: Math.round((receivable + Number.EPSILON) * 100) / 100,
          });
        } else {
          setArDetail([]);
        }
      } catch { setArDetail([]); /* ดึงลูกหนี้ไม่ได้ → ข้ามหมวดนี้ (ไม่ให้ทั้งรายงานพัง) */ }

      setRows(computed);
      setLoadedDate(date);
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + (e.message || e));
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { loadReport(); /* eslint-disable-next-line */ }, []);

  // debit/credit ต่อแถว — สินทรัพย์: ยอดบวก = เดบิต, ยอดลบ = เครดิต
  const lines = useMemo(
    () => rows.map((r) => ({
      ...r,
      debit: r.balance >= 0 ? r.balance : 0,
      credit: r.balance < 0 ? Math.abs(r.balance) : 0,
    })),
    [rows]
  );

  const cashLines = lines.filter((r) => r.group === "cash");
  const bankLines = lines.filter((r) => r.group === "bank");
  const arLines = lines.filter((r) => r.group === "ar");
  const sumDebit = lines.reduce((s, r) => s + r.debit, 0);
  const sumCredit = lines.reduce((s, r) => s + r.credit, 0);
  const cashTotal = cashLines.reduce((s, r) => s + r.balance, 0);
  const bankTotal = bankLines.reduce((s, r) => s + r.balance, 0);
  const arTotal = arLines.reduce((s, r) => s + r.balance, 0);
  // เดบิต/เครดิตรวมต่อหมวด (gross) สำหรับบรรทัดสรุป
  const grp = (ls) => ({ debit: ls.reduce((s, r) => s + r.debit, 0), credit: ls.reduce((s, r) => s + r.credit, 0) });
  const cashG = grp(cashLines), bankG = grp(bankLines), arG = grp(arLines);

  return (
    <div className="page-container">
      <style>{`
        @media print {
          .no-print, .no-print * { display: none !important; }
          .sidebar, aside.sidebar, .page-topbar { display: none !important; }
          body, html, #root, .page-container { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .tb-table { font-size: 12px !important; width: 100% !important; }
          .tb-table th, .tb-table td { padding: 4px 8px !important; }
          @page { size: portrait; margin: 14mm; }
        }
      `}</style>

      <div className="page-topbar">
        <div className="page-title">📋 รายงานงบทดลอง — เงินสด / เงินฝากธนาคาร / ลูกหนี้</div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>📅 ณ วันที่</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={{ ...inp, minWidth: 160 }} />
          </div>
          <div>
            <button onClick={() => loadReport()} disabled={loading}
              style={{ padding: "8px 18px", background: loading ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
              🔄 {loading ? "กำลังคิดยอด..." : "ดูรายงาน"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            คิดยอดแบบเดียวกับหน้า "ความเคลื่อนไหวธนาคาร" (ยอดยกมา + ความเคลื่อนไหวถึงวันที่เลือก)
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={() => window.print()} disabled={loading || rows.length === 0}
              style={{ padding: "8px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              🖨️ พิมพ์
            </button>
          </div>
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <SummaryCard color="#dcfce7" textColor="#065f46" label="💵 รวมเงินสด" value={cashTotal} />
        <SummaryCard color="#dbeafe" textColor="#1e40af" label="🏦 รวมเงินฝากธนาคาร" value={bankTotal} />
        <SummaryCard color="#fee2e2" textColor="#991b1b" label="🧾 รวมลูกหนี้ (ค้างชำระค่ารถ)" value={arTotal} />
        <SummaryCard color="#fef3c7" textColor="#92400e" label="รวมทั้งสิ้น (เดบิตสุทธิ)" value={cashTotal + bankTotal + arTotal} />
      </div>

      {/* Report */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#072d6b" }}>งบทดลอง</div>
          <div style={{ fontSize: 13, color: "#374151" }}>หมวดเงินสด เงินฝากธนาคาร และลูกหนี้</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>ณ วันที่ {fmtDateTH(loadedDate || asOfDate)}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังคิดยอด...</div>
        ) : lines.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ไม่มีข้อมูลบัญชี</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tb-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#072d6b", color: "#fff" }}>
                  <th style={{ ...th, width: 40 }}>#</th>
                  <th style={{ ...th, textAlign: "left" }}>หมวดบัญชี</th>
                  <th style={{ ...th, textAlign: "center", width: 110 }}>จำนวน</th>
                  <th style={{ ...th, textAlign: "right", width: 160 }}>เดบิต</th>
                  <th style={{ ...th, textAlign: "right", width: 160 }}>เครดิต</th>
                </tr>
              </thead>
              <tbody>
                <SummaryRow index={1} label="เงินสด" color="#065f46" count={cashLines.length}
                  debit={cashG.debit} credit={cashG.credit} onClick={() => cashLines.length && setPopup("cash")} />
                <SummaryRow index={2} label="เงินฝากธนาคาร" color="#1e40af" count={bankLines.length}
                  debit={bankG.debit} credit={bankG.credit} onClick={() => bankLines.length && setPopup("bank")} />
                {arLines.length > 0 && (
                  <SummaryRow index={3} label="ลูกหนี้การค้า (ค้างชำระค่ารถ)" color="#991b1b" count={arDetail.length}
                    debit={arG.debit} credit={arG.credit} onClick={() => setPopup("ar")} />
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b", borderTop: "2px solid #072d6b" }}>
                  <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวมทั้งสิ้น</td>
                  <td style={{ ...tdNum }}>{fmtN(sumDebit)}</td>
                  <td style={{ ...tdNum }}>{fmtN(sumCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="no-print" style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
          * คลิกที่หมวดเพื่อดูรายละเอียด · ลูกหนี้ = ยอดค้างชำระค่ารถทุกใบที่ออกถึงวันที่เลือก (สูตรเดียวกับหน้า "รายงานรับชำระเงินรายคัน") — หมวดอื่น (เจ้าหนี้/รายได้/ค่าใช้จ่าย ฯลฯ) จะทยอยเพิ่มภายหลัง
        </div>
      </div>

      {popup && (
        <DetailModal
          popup={popup}
          cashLines={cashLines}
          bankLines={bankLines}
          arDetail={arDetail}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

// บรรทัดสรุปหมวด (คลิกเปิด popup รายละเอียด)
function SummaryRow({ index, label, color, count, debit, credit, onClick }) {
  return (
    <tr onClick={onClick} title="คลิกดูรายละเอียด"
      style={{ borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
      <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{index}</td>
      <td style={{ ...td, fontWeight: 700 }}>
        <span style={{ color }}>{label}</span>
        <span className="no-print" style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: "#2563eb" }}>🔍 ดูรายละเอียด</span>
      </td>
      <td style={{ ...td, textAlign: "center", fontSize: 12, color: "#6b7280" }}>{count} รายการ</td>
      <td style={{ ...tdNum }}>{debit > 0 ? fmtN(debit) : "-"}</td>
      <td style={{ ...tdNum, color: credit > 0 ? "#dc2626" : undefined }}>{credit > 0 ? fmtN(credit) : "-"}</td>
    </tr>
  );
}

// Popup รายละเอียดรายหมวด
function DetailModal({ popup, cashLines, bankLines, arDetail, onClose }) {
  const isAr = popup === "ar";
  const title = popup === "cash" ? "💵 เงินสด" : popup === "bank" ? "🏦 เงินฝากธนาคาร" : "🧾 ลูกหนี้การค้า (ค้างชำระค่ารถ)";
  const accLines = popup === "cash" ? cashLines : bankLines;
  const accDebit = accLines.reduce((s, r) => s + r.debit, 0);
  const accCredit = accLines.reduce((s, r) => s + r.credit, 0);
  const arTotal = arDetail.reduce((s, r) => s + Number(r.remaining || 0), 0);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(820px, 96vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b" }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#072d6b", color: "#fff" }}>
                <th style={{ ...th, width: 36 }}>#</th>
                {isAr ? (
                  <>
                    <th style={{ ...th, textAlign: "left" }}>ลูกค้า</th>
                    <th style={{ ...th, textAlign: "left" }}>เลขที่ใบกำกับ / ใบขาย</th>
                    <th style={{ ...th, textAlign: "center" }}>วันที่ขาย</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดค้าง</th>
                  </>
                ) : (
                  <>
                    <th style={{ ...th, textAlign: "left" }}>ชื่อบัญชี</th>
                    <th style={{ ...th, textAlign: "left" }}>ธนาคาร / เลขที่บัญชี</th>
                    <th style={{ ...th, textAlign: "right" }}>เดบิต</th>
                    <th style={{ ...th, textAlign: "right" }}>เครดิต</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isAr
                ? arDetail.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                      <td style={{ ...td }}>{r.customer_name}{r.finance ? <div style={{ fontSize: 11, color: "#6b7280" }}>📋 {r.finance}</div> : null}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.tax_invoice_no || "-"}{r.sale_invoice_no ? <div style={{ color: "#0369a1" }}>{r.sale_invoice_no}</div> : null}</td>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{fmtDateTH(r.sale_date)}</td>
                      <td style={{ ...tdNum, color: "#991b1b" }}>{fmtN(r.remaining)}</td>
                    </tr>
                  ))
                : accLines.map((r, i) => (
                    <tr key={r.account_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                      <td style={{ ...td }}>{r.account_name}</td>
                      <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{[r.bank_name, r.account_no].filter(Boolean).join(" · ") || "-"}</td>
                      <td style={{ ...tdNum }}>{r.debit > 0 ? fmtN(r.debit) : "-"}</td>
                      <td style={{ ...tdNum, color: r.credit > 0 ? "#dc2626" : undefined }}>{r.credit > 0 ? fmtN(r.credit) : "-"}</td>
                    </tr>
                  ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b" }}>
                {isAr ? (
                  <>
                    <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {arDetail.length} คัน</td>
                    <td style={{ ...tdNum, color: "#991b1b" }}>{fmtN(arTotal)}</td>
                  </>
                ) : (
                  <>
                    <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม</td>
                    <td style={{ ...tdNum }}>{fmtN(accDebit)}</td>
                    <td style={{ ...tdNum }}>{fmtN(accCredit)}</td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ color, textColor, label, value }) {
  return (
    <div style={{ padding: "12px 16px", background: color, borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: textColor, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, color: textColor, fontWeight: 700, marginTop: 4 }}>{fmtN(value)}</div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 };
const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const th = { padding: "8px 10px", textAlign: "center", fontWeight: 600 };
const td = { padding: "6px 10px", verticalAlign: "top" };
const tdNum = { padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" };
