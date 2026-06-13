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
        let arCount = 0;
        const receivable = cpr.reduce((s, r) => {
          if (isPreCutoff(r)) return s;
          const rem = Number(r.total_amount || 0) - (Number(r.total_paid || 0) + ftPaid(r));
          if (rem > 0.01) arCount++;
          return s + Math.max(0, rem);
        }, 0);
        if (receivable > 0) {
          computed.push({
            account_id: "ar-car-payment",
            account_name: "ลูกหนี้การค้า — ค้างชำระค่ารถ",
            account_no: "",
            bank_name: `${arCount} คัน`,
            account_type: "ลูกหนี้",
            group: "ar",
            balance: Math.round((receivable + Number.EPSILON) * 100) / 100,
          });
        }
      } catch { /* ดึงลูกหนี้ไม่ได้ → ข้ามหมวดนี้ (ไม่ให้ทั้งรายงานพัง) */ }

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
                  <th style={{ ...th, textAlign: "left" }}>ชื่อบัญชี</th>
                  <th style={{ ...th, textAlign: "left" }}>ธนาคาร / เลขที่บัญชี</th>
                  <th style={{ ...th, textAlign: "right", width: 150 }}>เดบิต</th>
                  <th style={{ ...th, textAlign: "right", width: 150 }}>เครดิต</th>
                </tr>
              </thead>
              <tbody>
                <GroupBlock title="เงินสด" lines={cashLines} startIndex={0} />
                <GroupBlock title="เงินฝากธนาคาร" lines={bankLines} startIndex={cashLines.length} />
                {arLines.length > 0 && (
                  <GroupBlock title="ลูกหนี้" lines={arLines} startIndex={cashLines.length + bankLines.length} />
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
          * ลูกหนี้ = ยอดค้างชำระค่ารถทุกใบที่ออกถึงวันที่เลือก (สูตรคงเหลือเดียวกับหน้า "รายงานรับชำระเงินรายคัน") — หมวดอื่น (เจ้าหนี้/รายได้/ค่าใช้จ่าย ฯลฯ) จะทยอยเพิ่มภายหลัง
        </div>
      </div>
    </div>
  );
}

// กลุ่มบัญชี: หัวข้อกลุ่ม + แถวบัญชี + ยอดรวมกลุ่ม
function GroupBlock({ title, lines, startIndex }) {
  const subDebit = lines.reduce((s, r) => s + r.debit, 0);
  const subCredit = lines.reduce((s, r) => s + r.credit, 0);
  return (
    <>
      <tr style={{ background: "#eff6ff" }}>
        <td colSpan={5} style={{ padding: "6px 10px", fontWeight: 700, color: "#1e40af" }}>{title}</td>
      </tr>
      {lines.length === 0 ? (
        <tr><td colSpan={5} style={{ ...td, color: "#9ca3af", textAlign: "center" }}>— ไม่มีบัญชี —</td></tr>
      ) : (
        lines.map((r, i) => (
          <tr key={r.account_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{startIndex + i + 1}</td>
            <td style={{ ...td }}>{r.account_name}</td>
            <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>
              {[r.bank_name, r.account_no].filter(Boolean).join(" · ") || "-"}
            </td>
            <td style={{ ...tdNum }}>{r.debit > 0 ? fmtN(r.debit) : "-"}</td>
            <td style={{ ...tdNum, color: r.credit > 0 ? "#dc2626" : undefined }}>{r.credit > 0 ? fmtN(r.credit) : "-"}</td>
          </tr>
        ))
      )}
      <tr style={{ background: "#f8fafc", fontWeight: 600 }}>
        <td colSpan={3} style={{ ...td, textAlign: "right", color: "#374151" }}>รวม{title}</td>
        <td style={{ ...tdNum }}>{fmtN(subDebit)}</td>
        <td style={{ ...tdNum }}>{fmtN(subCredit)}</td>
      </tr>
    </>
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
