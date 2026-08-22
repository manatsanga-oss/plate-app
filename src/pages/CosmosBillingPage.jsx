import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const FINANCE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api"; // รายได้อื่น ๆ (income_records) — ใช้ตัดยอดจ่าย

const PLAN_OPTS = [
  { key: "rsa",           label: "RSA (ช่วยเหลือฉุกเฉิน)",     color: "#1565c0" },
  { key: "pa",            label: "PA (อุบัติเหตุส่วนบุคคล)",    color: "#2e7d32" },
  { key: "3plus",         label: "3 PLUS",                       color: "#7b1fa2" },
  { key: "theft",         label: "ประกันรถหาย",                color: "#c62828" },
  { key: "theft_renewal", label: "ประกันรถหายปีต่อ",          color: "#ea580c" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()+543}`;
}

export default function CosmosBillingPage({ currentUser }) {
  const [mode, setMode] = useState("list");
  const [message, setMessage] = useState("");
  const currentPlan = { color: "#1565c0" }; // สีหลักของหน้า (ไม่กรองตาม plan)

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 วางบิล ประกัน COSMOS</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["list", "📑 รายการจ่าย"],
          ["payment", "💵 บันทึกจ่ายเงิน"],
          ["history", "📋 ประวัติการจ่ายเงิน"],
          ["overpaid", "💱 เงินชำระเกิน รอโอนคืน"],
          ["recon", "🛡️ กระทบยอดใบขาย NEW"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => { setMode(v); setMessage(""); }}
            style={{ padding: "10px 20px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: mode === v ? "#072d6b" : "#6b7280",
              borderBottom: mode === v ? "3px solid #072d6b" : "3px solid transparent",
              marginBottom: -2 }}>{label}</button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>
      )}

      {mode === "list" && <ListAllPanel currentPlan={currentPlan} setMessage={setMessage} />}
      {mode === "payment" && <PaymentPanel currentPlan={currentPlan} setMessage={setMessage} currentUser={currentUser} />}
      {mode === "history" && <HistoryPanel currentPlan={currentPlan} setMessage={setMessage} />}
      {mode === "overpaid" && <OverpaidPanel currentPlan={currentPlan} setMessage={setMessage} currentUser={currentUser} />}
      {mode === "recon" && <TheftReconPanel setMessage={setMessage} />}
    </div>
  );
}

// ===== กระทบยอด ใบขาย NEW ↔ กรมธรรม์ประกันรถหาย COSMOS (2026-08-22) =====
// ของแถมประกันรถหาย COSMOS คำนวณจากกฎโปร (ไม่ได้เก็บรายใบ): ปีต่อ = กฎกลุ่มไฟแนนท์ชื่อมี "ปีต่อ" + COSMOS (ยกเว้นรุ่นตาม note exclude:), เงินสด = กฎรุ่นชื่อ "ประกันรถหายเงินสด"
// จับคู่กับกรมธรรม์ COSMOS (cosmos_theft plan theft/theft_renewal) ด้วยเลขตัวถัง → หาใบขายที่ควรมีกรมธรรม์แต่ไม่พบ / กรมธรรม์ที่ไม่ตรงกฎ
const RETAIL_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
function TheftReconPanel({ setMessage }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState("2026-08-01");
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [rules, setRules] = useState([]);
  const [series, setSeries] = useState([]);
  const [filter, setFilter] = useState("issue");
  const [kw, setKw] = useState("");

  const post = async (url, body) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const t = await r.text(); return t.trim() ? JSON.parse(t) : [];
  };
  async function load() {
    setLoading(true); setMessage("");
    try {
      const [s, p, r, se] = await Promise.all([
        post(RETAIL_URL, { action: "list_retail_sales", date_from: dateFrom, date_to: dateTo, limit: 3000 }),
        post(API_URL, { action: "list_cosmos_all" }),
        post(MASTER_URL, { action: "get_sale_expenses" }),
        post(MASTER_URL, { action: "get_series" }),
      ]);
      const arr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);
      setSales(arr(s).filter((x) => x && x.invoice_no));
      setPolicies(arr(p).filter((x) => x && ["theft", "theft_renewal"].includes(x.plan)));
      setRules(arr(r).filter((x) => x && x.expense_type === "promotion" && x.status === "active"));
      setSeries(arr(se));
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const normC = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isTheftName = (n) => /ประกันรถหาย|รถหาย/.test(String(n || "").replace(/\s+/g, ""));
  const isCosmos = (g) => /COSMOS|คอสมอส/i.test(String(g.expense_name || "") + " " + String(g.category || ""));
  const inRange = (e, d) => {
    const eff = e.effective_date ? String(e.effective_date).slice(0, 10) : "";
    const end = e.end_date ? String(e.end_date).slice(0, 10) : "";
    return !((eff && eff > d) || (end && end < d));
  };
  const excluded = (note, codes) => {
    const m = String(note || "").match(/^exclude:(.*)$/i);
    if (!m) return false;
    const toks = m[1].split(",").map(normC).filter(Boolean);
    const cs = codes.map(normC).filter(Boolean);
    return toks.some((t) => t !== "BIGBIKE" && cs.some((c) => c.startsWith(t) || t.startsWith(c)));
  };
  const normCo = (v) => String(v || "").replace(/บริษัท|จำกัด|\(มหาชน\)|\s+/g, "");
  const shortCo = (v) => String(v || "").replace(/บริษัท |จำกัด|\(มหาชน\)/g, "").trim();
  // ใบขาย → ของแถมประกันรถหาย COSMOS ที่ "ควรมี" ตามกฎ
  const expectOf = (sale) => {
    const d = String(sale.sale_date || "").slice(0, 10);
    const codes = [sale.model_code, sale.model_name];
    const fin = sale.finance_type === "moto";
    const out = [];
    for (const e of rules) {
      if (!isTheftName(e.expense_name) || !isCosmos(e) || !inRange(e, d)) continue;
      if (e.group_by === "finance") {
        if (!fin || normCo(e.company_name) !== normCo(sale.finance_company_name)) continue;
        if (excluded(e.note, codes)) continue;
        out.push({ kind: /ปีต่อ/.test(e.expense_name) ? "theft_renewal" : "theft", name: e.expense_name, amount: Number(e.amount) || 0 });
      } else if (e.group_by === "series") {
        const [sid, pc] = String(e.note || "").split("|");
        const sr = series.find((x) => String(x.series_id) === String(sid));
        if (!sr) continue;
        const mc = normC(sale.model_code), sn = normC(sr.series_name);
        if (!(mc && sn && (mc.startsWith(sn) || normC(sale.model_name).startsWith(sn)))) continue;
        if ((pc || "all") === "cash" && fin) continue;
        if ((pc || "all") === "finance" && !fin) continue;
        out.push({ kind: "theft", name: e.expense_name, amount: Number(e.amount) || 0 });
      }
    }
    return out;
  };
  const polByChassis = {};
  for (const p of policies) { const k = normC(p.chassis_no); if (k) (polByChassis[k] = polByChassis[k] || []).push(p); }
  const saleChassis = new Set(sales.map((x) => normC(x.chassis_no)).filter(Boolean));

  const rows = sales.map((sale) => {
    const exp = expectOf(sale);
    const pols = polByChassis[normC(sale.chassis_no)] || [];
    let status, note = "";
    if (exp.length === 0 && pols.length === 0) status = "none";
    else if (exp.length > 0 && pols.length === 0) { status = "missing"; note = "ควรมีกรมธรรม์ " + exp.map((e) => e.name).join(", ") + " แต่ไม่พบ (ยังไม่อัปโหลด/ยังไม่ซื้อ)"; }
    else if (exp.length === 0 && pols.length > 0) { status = "unexpected"; note = "มีกรมธรรม์ " + pols.map((p) => p.plan_name || p.plan).join(", ") + " แต่กฎโปรไม่ได้ให้ (ไฟแนนท์/รุ่นไม่เข้ากฎ)"; }
    else {
      const expKinds = new Set(exp.map((e) => e.kind)), polKinds = new Set(pols.map((p) => p.plan));
      const miss = [...expKinds].filter((k) => !polKinds.has(k)), extra = [...polKinds].filter((k) => !expKinds.has(k));
      if (!miss.length && !extra.length) status = "ok";
      else { status = "mismatch"; note = (miss.length ? "ขาด " + miss.join(",") : "") + (extra.length ? " เกิน " + extra.join(",") : ""); }
    }
    return { sale, exp, pols, status, note };
  });
  const orphanPolicies = policies.filter((p) => { const k = normC(p.chassis_no); return k && !saleChassis.has(k); });

  const kwl = kw.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (filter === "issue" && !["missing", "unexpected", "mismatch"].includes(r.status)) return false;
    if (kwl && ![r.sale.invoice_no, r.sale.customer_name, r.sale.chassis_no, r.sale.finance_company_name, r.sale.model_name].some((v) => String(v || "").toLowerCase().includes(kwl))) return false;
    return true;
  });
  const cnt = (st) => rows.filter((r) => r.status === st).length;
  const badge = (st) => {
    const m = { ok: ["✅ ตรง", "#dcfce7", "#166534"], missing: ["⚠️ ไม่พบกรมธรรม์", "#fef3c7", "#92400e"], unexpected: ["❓ มีกรมธรรม์แต่ไม่เข้ากฎ", "#fee2e2", "#991b1b"], mismatch: ["⚠️ แผนไม่ตรง", "#fee2e2", "#991b1b"], none: ["— ไม่เกี่ยว", "#f3f4f6", "#6b7280"] }[st];
    return <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: m[1], color: m[2], whiteSpace: "nowrap" }}>{m[0]}</span>;
  };
  const th = { padding: "8px 6px", fontSize: 12, textAlign: "left", background: "#072d6b", color: "#fff", whiteSpace: "nowrap" };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 };
  const finRules = rules.filter((e) => e.group_by === "finance" && isTheftName(e.expense_name) && isCosmos(e));
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span>ใบขาย NEW ตั้งแต่</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        <button onClick={load} disabled={loading} style={{ padding: "8px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "กำลังโหลด..." : "🔍 กระทบยอด"}</button>
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="ค้นหา ใบขาย/ลูกค้า/เลขถัง/ไฟแนนท์" style={{ ...inp, width: 280 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={inp}>
          <option value="issue">เฉพาะที่มีปัญหา</option>
          <option value="all">ทุกใบขาย</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
        {[["ok", "✅ ตรง"], ["missing", "⚠️ ควรมีแต่ไม่พบกรมธรรม์"], ["unexpected", "❓ มีกรมธรรม์แต่ไม่เข้ากฎ"], ["mismatch", "⚠️ แผนไม่ตรง"], ["none", "ไม่เกี่ยว"]].map(([k, l]) => (
          <span key={k} style={{ padding: "4px 10px", borderRadius: 8, background: "#f3f4f6" }}>{l}: <b>{cnt(k)}</b></span>
        ))}
        <span style={{ padding: "4px 10px", borderRadius: 8, background: "#f3f4f6" }}>กรมธรรม์ที่ไม่พบใบขาย NEW ในช่วงนี้: <b>{orphanPolicies.length}</b> (ใบขายจาก upload/ก่อนช่วง)</span>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        กฎ: ปีต่อ COSMOS = ผ่อนกับ {finRules.map((e) => shortCo(e.company_name)).join(" / ") || "-"} (ยกเว้นรุ่นตามกฎ) · เงินสด = กฎ "ประกันรถหายเงินสด" รายรุ่น · ใบที่ "ไม่พบกรมธรรม์" อาจเพราะยังไม่อัปโหลดไฟล์ COSMOS ของเดือนนั้น
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>ใบขาย</th><th style={th}>วันที่</th><th style={th}>ลูกค้า</th><th style={th}>รถ / เลขถัง</th><th style={th}>ไฟแนนท์</th><th style={th}>ควรมี (ตามกฎ)</th><th style={th}>กรมธรรม์ COSMOS ที่พบ</th><th style={th}>สถานะ</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 20 }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการ"}</td></tr>}
            {shown.map((r) => (
              <tr key={r.sale.invoice_no}>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8" }}>{r.sale.invoice_no}</td>
                <td style={td}>{fmtDate(r.sale.sale_date)}</td>
                <td style={td}>{r.sale.customer_name}</td>
                <td style={td}>{[r.sale.brand, r.sale.model_name || r.sale.model_code].filter(Boolean).join(" ")}<div style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{r.sale.chassis_no}</div></td>
                <td style={td}>{r.sale.finance_type === "moto" ? shortCo(r.sale.finance_company_name) : "เงินสด"}</td>
                <td style={td}>{r.exp.length ? r.exp.map((e, i) => <div key={i}>{e.name} <span style={{ color: "#6b7280" }}>({fmt(e.amount)})</span></div>) : "-"}</td>
                <td style={td}>{r.pols.length ? r.pols.map((p) => <div key={p.app_no}><b>{p.plan_name || p.plan}</b> · {p.app_no} · {fmt(p.premium)}{p.invoice_no ? <span style={{ color: "#6b7280" }}> · {p.invoice_no}</span> : null}</div>) : "-"}</td>
                <td style={td}>{badge(r.status)}{r.note && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{r.note}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ======================== TAB: รายการจ่าย (ดูทั้งหมด แยกตามหัวข้อ กรองเดือน) ======================== */
const PAY_STATUS = {
  pending: { label: "รอวางบิล", bg: "#fef3c7", color: "#92400e" },
  billed: { label: "วางบิลแล้ว", bg: "#dbeafe", color: "#1e40af" },
  paid: { label: "จ่ายแล้ว", bg: "#dcfce7", color: "#166534" },
};
function curMonthDates() {
  const n = new Date();
  const y = n.getFullYear(), m = n.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}
function ListAllPanel({ currentPlan, setMessage }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => curMonthDates().from); // default = เดือนปัจจุบัน
  const [dateTo, setDateTo] = useState(() => curMonthDates().to);
  const [statusFilter, setStatusFilter] = useState("");
  const [openPlans, setOpenPlans] = useState(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_all", date_from: dateFrom, date_to: dateTo }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      setRows(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setRows([]); setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (statusFilter && r.pay_status !== statusFilter) return false;
    if (kw && ![r.app_no, r.customer_name, r.chassis_no, r.invoice_no, r.paid_doc_no].some(v => String(v || "").toLowerCase().includes(kw))) return false;
    return true;
  });
  // จัดกลุ่มตามหัวข้อ (แผน)
  const byPlan = {};
  filtered.forEach(r => { (byPlan[r.plan] = byPlan[r.plan] || []).push(r); });
  const grandTotal = filtered.reduce((s, r) => s + Number(r.premium || 0), 0);
  // สรุปสถานะการจ่ายรวม (จำนวน + ยอด)
  const statusSum = { pending: { n: 0, amt: 0 }, billed: { n: 0, amt: 0 }, paid: { n: 0, amt: 0 } };
  filtered.forEach(r => { const s = statusSum[r.pay_status]; if (s) { s.n += 1; s.amt += Number(r.premium || 0); } });
  const togglePlan = (p) => setOpenPlans(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });

  return (
    <div>
      <div style={{ display: "flex", gap: 12, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>📅 วันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}>
          <option value="">สถานะ: ทั้งหมด</option>
          <option value="pending">รอวางบิล</option>
          <option value="billed">วางบิลแล้ว</option>
          <option value="paid">จ่ายแล้ว</option>
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 App No. / ลูกค้า / เลขถัง"
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, minWidth: 200 }} />
        <button onClick={fetchData} style={btn(currentPlan.color)}>🔄 รีเฟรช</button>
        <span style={{ marginLeft: "auto" }}>📋 <strong>{filtered.length}</strong> รายการ · 💰 <strong style={{ color: currentPlan.color }}>{fmt(grandTotal)}</strong> บาท</span>
      </div>

      {/* สรุปสถานะการจ่าย */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(PAY_STATUS).map(([k, s]) => (
          <div key={k} onClick={() => setStatusFilter(statusFilter === k ? "" : k)} title="คลิกเพื่อกรองสถานะนี้"
            style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: statusFilter === k ? s.bg : "#fff",
              border: `2px solid ${statusFilter === k ? s.color : "#e5e7eb"}`, borderRadius: 10, cursor: "pointer", userSelect: "none" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
              <span style={{ padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span>
            </div>
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{statusSum[k].n}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{fmt(statusSum[k].amt)} บาท</span>
            </div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       filtered.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>ไม่มีรายการในช่วงวันที่ที่เลือก</div> :
       PLAN_OPTS.filter(p => byPlan[p.key]?.length).map(p => {
        const items = byPlan[p.key];
        const total = items.reduce((s, r) => s + Number(r.premium || 0), 0);
        // RSA / THEFT / THEFT_RENEWAL: เบี้ยเป็นยอดรวม VAT — ถอด 7% แสดงยอดก่อน VAT + VAT (PA ไม่มี VAT)
        const hasVat = ["rsa", "theft", "theft_renewal"].includes(p.key);
        const exVat = (amt) => Math.round((Number(amt || 0) / 1.07) * 100) / 100;
        const totalBase = hasVat ? items.reduce((s, r) => s + exVat(r.premium), 0) : total;
        const totalVat = hasVat ? Math.round((total - totalBase) * 100) / 100 : 0;
        const cnt = { pending: 0, billed: 0, paid: 0 };
        items.forEach(r => { cnt[r.pay_status] = (cnt[r.pay_status] || 0) + 1; });
        const isOpen = openPlans.has(p.key);
        return (
          <div key={p.key} style={{ marginBottom: 12, background: "#fff", border: `1px solid ${p.color}44`, borderRadius: 10, overflow: "hidden" }}>
            <div onClick={() => togglePlan(p.key)} title="คลิกเพื่อดูรายการ"
              style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, width: 14, color: p.color }}>{isOpen ? "▼" : "▶"}</span>
              <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700, background: p.color, color: "#fff", minWidth: 60, textAlign: "center", textTransform: "uppercase" }}>{p.key}</span>
              <span style={{ fontSize: 13, color: "#374151" }}>{p.label}</span>
              {Object.entries(PAY_STATUS).map(([k, s]) => cnt[k] > 0 && (
                <span key={k} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label} {cnt[k]}</span>
              ))}
              <span style={{ marginLeft: "auto", textAlign: "right" }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: p.color }}>{items.length} รายการ · {fmt(total)} บาท</span>
                {hasVat && (
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
                    ก่อน VAT {fmt(totalBase)} · <span style={{ color: "#dc2626" }}>VAT {fmt(totalVat)}</span>
                  </span>
                )}
              </span>
            </div>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${p.color}44`, overflow: "auto", maxHeight: 420 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: p.color, color: "#fff", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>App No.</th>
                      <th style={th}>วันที่บันทึก</th>
                      <th style={th}>ลูกค้า</th>
                      <th style={th}>เลขถัง</th>
                      <th style={th}>แผน</th>
                      <th style={{ ...th, textAlign: "right" }}>เบี้ย</th>
                      <th style={th}>สถานะ</th>
                      <th style={th}>เลขใบจ่าย</th>
                      <th style={th}>วันที่จ่าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => {
                      const s = PAY_STATUS[r.pay_status] || PAY_STATUS.pending;
                      return (
                        <tr key={r.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={td}>{i + 1}</td>
                          <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: p.color }}>{r.app_no}</td>
                          <td style={td}>{fmtDate(r.submitted_at)}</td>
                          <td style={td}>{r.customer_name || "-"}</td>
                          <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
                          <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.plan_name || "-"}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {fmt(r.premium)}
                            {hasVat && (
                              <div style={{ fontSize: 10, fontWeight: 500, color: "#6b7280" }}>
                                ก่อน VAT {fmt(exVat(r.premium))} · <span style={{ color: "#dc2626" }}>VAT {fmt(Math.round((Number(r.premium || 0) - exVat(r.premium)) * 100) / 100)}</span>
                              </div>
                            )}
                          </td>
                          <td style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span></td>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#065f46" }}>{r.paid_doc_no || "-"}</td>
                          <td style={td}>{r.paid_at ? fmtDate(r.paid_at) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={td} colSpan={6}>รวม {items.length} รายการ</td>
                      <td style={{ ...td, textAlign: "right", color: p.color, whiteSpace: "nowrap" }}>
                        {fmt(total)}
                        {hasVat && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280" }}>
                            ก่อน VAT {fmt(totalBase)} · <span style={{ color: "#dc2626" }}>VAT {fmt(totalVat)}</span>
                          </div>
                        )}
                      </td>
                      <td style={td} colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ======================== TAB: รอวางบิล ======================== */
function PendingPanel({ plan, currentPlan, setMessage, currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); setSelected(new Set()); /* eslint-disable-next-line */ }, [plan]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_pending_billing", plan }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  function toggle(id) {
    setSelected(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  }
  function toggleAll() {
    setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  }

  const selRows = rows.filter(r => selected.has(r.id));
  const selSum = selRows.reduce((s, r) => s + Number(r.premium || 0), 0);

  async function saveBilling() {
    if (selRows.length === 0) { setMessage("⚠️ กรุณาเลือกรายการ"); return; }
    if (!window.confirm(`สร้างใบวางบิลสำหรับ ${selRows.length} รายการ ยอดรวม ${fmt(selSum)} บาท?`)) return;
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_cosmos_billing",
          plan,
          submission_ids: Array.from(selected),
          billed_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      setMessage(`✅ สร้างใบวางบิล ${data.billing_doc_no || ""} (${data.count || 0} รายการ)`);
      setSelected(new Set());
      fetchData();
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, alignItems: "center" }}>
        <span>📋 รวม: <strong>{rows.length}</strong> รายการ</span>
        <span style={{ color: "#7c3aed" }}>☑️ เลือก: <strong>{selected.size}</strong></span>
        <span style={{ color: currentPlan.color }}>💰 ยอด: <strong>{fmt(selSum)}</strong></span>
        <button onClick={fetchData} style={btn(currentPlan.color)}>🔄 รีเฟรช</button>
        <button onClick={saveBilling} disabled={saving || selected.size === 0} style={{ ...btn("#059669"), opacity: selected.size === 0 ? 0.5 : 1, marginLeft: "auto" }}>
          📝 สร้างใบวางบิล ({selected.size})
        </button>
      </div>
      <Table rows={rows} loading={loading} selected={selected} toggle={toggle} toggleAll={toggleAll} color={currentPlan.color} />
    </div>
  );
}

/* ======================== TAB: บันทึกจ่ายเงิน ======================== */
function PaymentPanel({ currentPlan, setMessage, currentUser }) {
  const [bills, setBills] = useState([]); // grouped by billing_doc_no
  const [loading, setLoading] = useState(false);
  const [selDocs, setSelDocs] = useState(new Set());
  const [showPay, setShowPay] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payForm, setPayForm] = useState({ paid_date: "", payment_method: "โอน", paid_to_vendor: "", payment_note: "", wht_rate: 0, wht_amount: 0, wht_base: 0, from_bank_account_id: "", income_doc_id: "", income_offset_doc_no: "", income_offset_amount: 0 });
  const [saving, setSaving] = useState(false);
  const [incomeDocs, setIncomeDocs] = useState([]); // ใบรายได้อื่น ๆ (ร่าง) — ใช้ตัดยอดจ่าย

  useEffect(() => { fetchData(); fetchVendors(); fetchBanks(); fetchIncomeDocs(); }, []);

  // ใบรายได้สถานะร่าง จากเมนูบันทึกรายได้อื่น ๆ (income_records) — เลือกมาหักออกจากยอดโอน
  // กรองเฉพาะลูกค้า บริษัท ประกันภัยไทยวิวัฒน์ (ใบส่วนลด/เงินคืนที่นำเข้าจากใบกำกับ)
  async function fetchIncomeDocs() {
    try {
      const res = await fetch(FINANCE_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_record", op: "list", status: "draft" }),
      });
      const text = await res.text();
      const d = text ? JSON.parse(text) : [];
      setIncomeDocs((Array.isArray(d) ? d : []).filter(x =>
        x && x.income_doc_no && /ไทยวิวัฒน์/i.test(String(x.customer_name || ""))
      ));
    } catch { setIncomeDocs([]); }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_billed" }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      // group by batch_no (= ใบวางบิล)
      const groups = {};
      rows.forEach(r => {
        if (!groups[r.batch_no]) groups[r.batch_no] = { batch_no: r.batch_no, billed_at: r.submitted_at, items: [], total: 0 };
        groups[r.batch_no].items.push(r);
        groups[r.batch_no].total += Number(r.premium) || 0;
      });
      setBills(Object.values(groups));
    } catch { setBills([]); }
    setLoading(false);
  }

  async function fetchVendors() {
    try {
      const res = await fetch(MASTER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }) });
      const d = await res.json(); setVendors(Array.isArray(d) ? d : []);
    } catch {}
  }
  async function fetchBanks() {
    try {
      const res = await fetch(ACC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) });
      const d = await res.json(); setBankAccounts(Array.isArray(d) ? d : []);
    } catch {}
  }

  function toggleDoc(no) { setSelDocs(s => { const ns = new Set(s); ns.has(no) ? ns.delete(no) : ns.add(no); return ns; }); }
  const selectedTotal = bills.filter(b => selDocs.has(b.batch_no)).reduce((s, b) => s + b.total, 0);
  // Base หัก ณ ที่จ่าย = เฉพาะประกันรถหาย (THEFT + THEFT_RENEWAL) — เบี้ยรวม VAT ต้องถอด VAT 7% ก่อน แล้วหัก 3%
  // แผนอื่น (RSA/PA/3PLUS) ไม่หัก
  const selectedTheftTotal = bills.filter(b => selDocs.has(b.batch_no) && ["theft", "theft_renewal"].includes(b.items[0]?.plan)).reduce((s, b) => s + b.total, 0);
  const theftWhtBase = Math.round((selectedTheftTotal / 1.07) * 100) / 100; // ถอด VAT 7% → มูลค่าก่อน VAT

  function openPayDialog() {
    if (selDocs.size === 0) { setMessage("⚠️ กรุณาเลือกใบวางบิล"); return; }
    const rate = theftWhtBase > 0 ? 3 : 0;
    const amt = Math.round((theftWhtBase * rate / 100) * 100) / 100;
    setPayForm({ paid_date: new Date().toISOString().slice(0,10), payment_method: "โอน", paid_to_vendor: "", payment_note: "", wht_rate: rate, wht_amount: amt, wht_base: theftWhtBase, from_bank_account_id: "", income_doc_id: "", income_offset_doc_no: "", income_offset_amount: 0, transfer_amount: "" });
    fetchIncomeDocs();
    setShowPay(true);
  }

  // เลือกใบรายได้มาตัดยอด — ยอดหัก = ยอดสุทธิของใบรายได้
  function onIncomeChange(docId) {
    const doc = incomeDocs.find(x => String(x.income_doc_id) === String(docId));
    setPayForm(p => ({
      ...p,
      income_doc_id: doc ? doc.income_doc_id : "",
      income_offset_doc_no: doc ? doc.income_doc_no : "",
      income_offset_amount: doc ? Number(doc.net_to_pay || doc.total || 0) : 0,
    }));
  }

  function onVendorChange(name) {
    const v = vendors.find(x => x.vendor_name === name);
    setPayForm(p => {
      // ใช้อัตราจาก vendor ถ้าตั้งไว้ ไม่งั้นคงอัตราเดิม (default 3% เมื่อมีประกันรถหาย)
      const rate = v && Number(v.wht_rate) > 0 ? Number(v.wht_rate) : Number(p.wht_rate) || 0;
      const base = Number(p.wht_base) || 0;
      const amt = rate > 0 ? Math.round((base * rate / 100) * 100) / 100 : 0;
      return { ...p, paid_to_vendor: name, wht_rate: rate, wht_amount: amt };
    });
  }

  async function submitPay() {
    if (!payForm.paid_to_vendor) { setMessage("❌ เลือก Vendor"); return; }
    if (!payForm.from_bank_account_id) { setMessage("❌ เลือกบัญชีโอนจาก"); return; }
    const offset = Number(payForm.income_offset_amount) || 0;
    if (offset > selectedTotal) { setMessage("❌ ยอดตัดรายได้มากกว่ายอดที่ต้องโอน"); return; }
    // COSMOS จ่ายเต็มไม่หัก WHT ออกจากยอดโอน — ยอด WHT ตั้งเป็น "ชำระเกิน รอโอนคืน" ให้ COSMOS โอนกลับ
    const whtAmt = Number(payForm.wht_amount) || 0;
    const required = Math.round((selectedTotal - offset) * 100) / 100;
    const keyed = payForm.transfer_amount === "" ? required : Number(payForm.transfer_amount) || 0;
    if (keyed < required - 0.005) { setMessage(`❌ ยอดเงินโอน (${fmt(keyed)}) น้อยกว่ายอดที่ต้องจ่าย (${fmt(required)}) — บันทึกไม่ได้`); return; }
    const overpaid = Math.round((keyed - required + whtAmt) * 100) / 100;
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_cosmos_payment",
          batch_nos: Array.from(selDocs),
          paid_date: payForm.paid_date,
          payment_method: payForm.payment_method,
          payment_note: payForm.payment_note,
          paid_to_vendor: payForm.paid_to_vendor,
          wht_rate: Number(payForm.wht_rate) || 0,
          wht_amount: Number(payForm.wht_amount) || 0,
          wht_base: Number(payForm.wht_base) || 0,
          from_bank_account_id: Number(payForm.from_bank_account_id) || null,
          income_offset_doc_no: payForm.income_offset_doc_no || "",
          income_offset_amount: offset,
          transfer_amount: keyed,
          overpaid_amount: overpaid,
          paid_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      const payNo = data.paid_doc_no || "";
      // ลงบันทึกรับชำระฝั่งรายได้อัตโนมัติ (income_records → paid, วิธี "หักกลบ")
      let incomeMsg = "";
      if (payForm.income_doc_id && offset > 0) {
        try {
          const r2 = await fetch(FINANCE_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "income_record", op: "save_payment",
              income_doc_ids: [Number(payForm.income_doc_id)],
              paid_date: payForm.paid_date,
              payment_method: "หักกลบ",
              payment_note: `หักกลบใบจ่ายประกัน COSMOS ${payNo}`,
              from_bank_account_id: null,
              paid_by: currentUser?.username || currentUser?.name || "system",
              payments: [{ method: "หักกลบ", amount: offset, from_bank_account_id: null, credit_note_no: null }],
            }),
          });
          const d2 = await r2.json().catch(() => ({}));
          const irc = d2?.paid_doc_no || d2?.[0]?.paid_doc_no || "";
          incomeMsg = ` · รับชำระรายได้ ${payForm.income_offset_doc_no}${irc ? ` (${irc})` : ""} แล้ว`;
        } catch { incomeMsg = ` · ⚠️ ตัดรายได้ ${payForm.income_offset_doc_no} ไม่สำเร็จ — ไปบันทึกรับเงินที่เมนูรายได้อื่น ๆ เอง`; }
      }
      setMessage(`✅ บันทึกจ่ายเงิน ${payNo} (${data.updated_count || 0} รายการ)${overpaid > 0 ? ` · 💱 ชำระเกิน ${fmt(overpaid)} → แท็บ "เงินชำระเกิน รอโอนคืน"` : ""}${incomeMsg}`);
      setShowPay(false);
      setSelDocs(new Set());
      fetchData();
      fetchIncomeDocs();
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, alignItems: "center" }}>
        <span>📦 Batch รอจ่าย: <strong>{bills.length}</strong></span>
        <span style={{ color: "#7c3aed" }}>☑️ เลือก: <strong>{selDocs.size}</strong></span>
        <span style={{ color: currentPlan.color }}>💰 ยอด: <strong>{fmt(selectedTotal)}</strong></span>
        <button onClick={fetchData} style={btn(currentPlan.color)}>🔄 รีเฟรช</button>
        <button onClick={openPayDialog} disabled={selDocs.size === 0} style={{ ...btn("#059669"), opacity: selDocs.size === 0 ? 0.5 : 1, marginLeft: "auto" }}>
          💵 บันทึกจ่ายเงิน ({selDocs.size})
        </button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       bills.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มี Batch ที่รอจ่าย</div> :
       bills.map(b => {
        // ใช้ plan ของรายการแรก (1 batch = 1 plan)
        const planKey = b.items[0]?.plan || "rsa";
        const planOpt = PLAN_OPTS.find(p => p.key === planKey) || PLAN_OPTS[0];
        const isSel = selDocs.has(b.batch_no);
        return (
          <label key={b.batch_no}
            style={{ marginBottom: 12, border: `2px solid ${isSel ? planOpt.color : "#e5e7eb"}`, borderRadius: 10, background: isSel ? "#fef3c7" : "#fff", overflow: "hidden", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer" }}>
            <input type="checkbox" checked={isSel} onChange={() => toggleDoc(b.batch_no)}
              style={{ width: 22, height: 22, cursor: "pointer", accentColor: planOpt.color }} />
            <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700, background: planOpt.color, color: "#fff", minWidth: 60, textAlign: "center", textTransform: "uppercase" }}>
              {planKey}
            </span>
            <strong style={{ fontFamily: "monospace", color: planOpt.color, fontSize: 14 }}>{b.batch_no}</strong>
            <span style={{ fontSize: 12, color: "#6b7280" }}>📅 {fmtDate(b.billed_at)}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 15, color: planOpt.color }}>
              {b.items.length} รายการ · <span style={{ fontSize: 17 }}>{fmt(b.total)}</span> บาท
            </span>
          </label>
        );
      })}

      {showPay && (
        <PaymentDialog payForm={payForm} setPayForm={setPayForm} vendors={vendors} bankAccounts={bankAccounts}
          onVendorChange={onVendorChange} totalSum={selectedTotal} onClose={() => setShowPay(false)}
          onSave={submitPay} saving={saving} numDocs={selDocs.size}
          incomeDocs={incomeDocs} onIncomeChange={onIncomeChange} />
      )}
    </div>
  );
}

/* ======================== TAB: ประวัติการจ่ายเงิน ======================== */
function HistoryPanel({ currentPlan, setMessage, currentUser }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openSet, setOpenSet] = useState(new Set());
  // แก้ไขใบจ่าย (เหมือนงาน พรบ.)
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [editPay, setEditPay] = useState(null); // group ที่กำลังแก้
  const [payForm, setPayForm] = useState({ paid_date: "", payment_method: "โอน", paid_to_vendor: "", payment_note: "", wht_rate: 0, wht_amount: 0, wht_base: 0, from_bank_account_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); fetchVendors(); fetchBanks(); }, []);

  async function fetchVendors() {
    try {
      const res = await fetch(MASTER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }) });
      const d = await res.json(); setVendors(Array.isArray(d) ? d : []);
    } catch {}
  }
  async function fetchBanks() {
    try {
      const res = await fetch(ACC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) });
      const d = await res.json(); setBankAccounts(Array.isArray(d) ? d : []);
    } catch {}
  }

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_paid" }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      // group by paid_doc_no
      const g = {};
      rows.forEach(r => {
        if (!g[r.paid_doc_no]) g[r.paid_doc_no] = {
          paid_doc_no: r.paid_doc_no, paid_at: r.paid_at, paid_to_vendor: r.paid_to_vendor,
          payment_method: r.payment_method, payment_note: r.payment_note,
          bank_account_name: r.bank_account_name, bank_name: r.bank_name, bank_account_no: r.bank_account_no,
          from_bank_account_id: r.from_bank_account_id,
          wht_rate: Number(r.wht_rate || 0), wht_base: Number(r.wht_base || 0),
          income_offset_doc_no: r.income_offset_doc_no || "", income_offset_amount: Number(r.income_offset_amount || 0),
          paid_transfer_amount: Number(r.paid_transfer_amount || 0), overpaid_amount: Number(r.overpaid_amount || 0),
          items: [], total: 0, wht: Number(r.wht_amount || 0)
        };
        g[r.paid_doc_no].items.push(r);
        g[r.paid_doc_no].total += Number(r.premium) || 0;
      });
      setGroups(Object.values(g));
    } catch { setGroups([]); }
    setLoading(false);
  }

  function toggleOpen(docNo) {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(docNo)) next.delete(docNo); else next.add(docNo);
      return next;
    });
  }

  // ===== แก้ไข/ยกเลิกใบจ่าย (เหมือนงาน พรบ.) =====
  function openEditPayment(g) {
    setEditPay(g);
    setPayForm({
      paid_date: g.paid_at ? String(g.paid_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
      payment_method: g.payment_method || "โอน",
      paid_to_vendor: g.paid_to_vendor || "",
      payment_note: g.payment_note || "",
      wht_rate: g.wht_rate || 0,
      wht_amount: g.wht || 0,
      wht_base: g.wht_base || g.total,
      from_bank_account_id: g.from_bank_account_id || "",
    });
  }
  function onEditVendorChange(name) {
    const v = vendors.find(x => x.vendor_name === name);
    const rate = v ? Number(v.wht_rate || 0) : 0;
    const base = Number(payForm.wht_base) || (editPay ? editPay.total : 0);
    const amt = rate > 0 ? Math.round((base * rate / 100) * 100) / 100 : 0;
    setPayForm(p => ({ ...p, paid_to_vendor: name, wht_rate: rate, wht_amount: amt }));
  }
  async function submitEdit() {
    if (!editPay) return;
    if (!payForm.paid_to_vendor) { setMessage("❌ เลือก Vendor"); return; }
    if (!payForm.from_bank_account_id) { setMessage("❌ เลือกบัญชีโอนจาก"); return; }
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_cosmos_payment",
          paid_doc_no: editPay.paid_doc_no,
          paid_date: payForm.paid_date,
          payment_method: payForm.payment_method,
          payment_note: payForm.payment_note,
          paid_to_vendor: payForm.paid_to_vendor,
          wht_rate: Number(payForm.wht_rate) || 0,
          wht_amount: Number(payForm.wht_amount) || 0,
          wht_base: Number(payForm.wht_base) || 0,
          from_bank_account_id: Number(payForm.from_bank_account_id) || null,
        }),
      });
      const data = await res.json();
      setMessage(`✅ แก้ไขใบจ่าย ${editPay.paid_doc_no} เรียบร้อย (${data.updated_count || 0} รายการ)`);
      setEditPay(null);
      fetchData();
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }
  async function cancelPayment(g) {
    const offsetWarn = g.income_offset_amount > 0 ? `\n\n⚠️ ใบนี้ตัดรายได้ ${g.income_offset_doc_no} (${fmt(g.income_offset_amount)}) ไว้ — ต้องไปยกเลิกใบรับเงินที่เมนู "บันทึกรายได้อื่น ๆ" เองด้วย` : "";
    if (!window.confirm(`ยกเลิกใบจ่ายเงิน ${g.paid_doc_no}?\n\nรายการ ${g.items.length} ใบจะกลับเป็น "รอจ่าย" (ยังวางบิลอยู่)${offsetWarn}`)) return;
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_cosmos_payment", paid_doc_no: g.paid_doc_no }),
      });
      const data = await res.json();
      setMessage(`✅ ยกเลิกใบจ่าย ${g.paid_doc_no} แล้ว (${data.cancelled_count || 0} รายการ กลับไปแท็บบันทึกจ่ายเงิน)`);
      fetchData();
    } catch (e) { setMessage("❌ ยกเลิกไม่สำเร็จ: " + e.message); }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <span>💵 ใบจ่ายเงิน: <strong>{groups.length}</strong></span>
        <span style={{ color: currentPlan.color }}>💰 ยอดรวม: <strong>{fmt(groups.reduce((s, g) => s + g.total, 0))}</strong></span>
        <button onClick={fetchData} style={{ ...btn(currentPlan.color), marginLeft: "auto" }}>🔄 รีเฟรช</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       groups.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติการจ่าย</div> :
       groups.map(g => {
        const isOpen = openSet.has(g.paid_doc_no);
        return (
        <div key={g.paid_doc_no} style={{ marginBottom: 12, background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, overflow: "hidden" }}>
          <div onClick={() => toggleOpen(g.paid_doc_no)}
               style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
               title="คลิกเพื่อดูรายละเอียดใบโอนเงิน">
            <span style={{ fontSize: 14, color: "#065f46", width: 14 }}>{isOpen ? "▼" : "▶"}</span>
            <strong style={{ fontFamily: "monospace", color: "#065f46", fontSize: 15 }}>{g.paid_doc_no}</strong>
            <span style={{ fontSize: 12 }}>📅 {fmtDate(g.paid_at)}</span>
            <span style={{ fontSize: 12 }}>👤 {g.paid_to_vendor || "-"}</span>
            <span style={{ fontSize: 12 }}>💰 {g.payment_method || "-"}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 16, color: "#065f46" }}>{g.items.length} ใบ · {fmt(g.total)}</span>
            {g.wht > 0 && <span style={{ fontSize: 12, color: "#dc2626" }}>WHT: {fmt(g.wht)}</span>}
            <button onClick={(e) => { e.stopPropagation(); toggleOpen(g.paid_doc_no); }} title="ดูรายละเอียด"
              style={{ padding: "3px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📋 ดู</button>
            <button onClick={(e) => { e.stopPropagation(); openEditPayment(g); }} title="แก้ไขรายละเอียดการจ่ายเงิน (วันที่/Vendor/บัญชี/WHT)"
              style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✏️ แก้ไข</button>
            <button onClick={(e) => { e.stopPropagation(); cancelPayment(g); }} title="ยกเลิกใบจ่าย — รายการกลับเป็นรอจ่าย"
              style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>🚫 ยกเลิก</button>
          </div>

          {isOpen && (
            <div style={{ borderTop: "1px solid #6ee7b7", background: "#fff", padding: "12px 16px" }}>
              {/* บันทึกการโอนเงิน — info block */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12, padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12 }}>
                <div><b>💳 วิธีจ่าย:</b> {g.payment_method || "-"}</div>
                <div><b>👤 จ่ายให้:</b> {g.paid_to_vendor || "-"}</div>
                <div><b>🏦 ธนาคาร:</b> {g.bank_name ? `${g.bank_name}${g.bank_account_no ? ` — ${g.bank_account_no}` : ""}` : "-"}</div>
                <div><b>📋 บัญชี:</b> {g.bank_account_name || "-"}</div>
                <div><b>💸 WHT:</b> {g.wht > 0 ? fmt(g.wht) : "—"}</div>
                <div><b>➖ ตัดรายได้:</b> {g.income_offset_amount > 0 ? `${g.income_offset_doc_no || ""} (${fmt(g.income_offset_amount)})` : "—"}</div>
                <div><b>💵 ยอดโอนจริง:</b> {fmt(g.paid_transfer_amount > 0 ? g.paid_transfer_amount : g.total - g.wht - (g.income_offset_amount || 0))}</div>
                {g.overpaid_amount > 0 && <div><b>💱 ชำระเกิน:</b> <span style={{ color: "#dc2626", fontWeight: 700 }}>{fmt(g.overpaid_amount)}</span> (ดูแท็บ "เงินชำระเกิน รอโอนคืน")</div>}
                {g.payment_note && <div style={{ gridColumn: "1 / -1" }}><b>📝 หมายเหตุ:</b> {g.payment_note}</div>}
              </div>

              {/* รายการใบวางบิลในใบโอน */}
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: currentPlan.color, color: "#fff" }}>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>App No.</th>
                      <th style={th}>ลูกค้า</th>
                      <th style={th}>เลขถัง</th>
                      <th style={th}>แผน</th>
                      <th style={th}>🚗 ใบขาย</th>
                      <th style={th}>📋 ใบรับเรื่อง</th>
                      <th style={{ ...th, textAlign: "right" }}>เบี้ย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((r, i) => (
                      <tr key={r.id || `${g.paid_doc_no}-${i}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: currentPlan.color }}>{r.app_no}</td>
                        <td style={td}>{r.customer_name || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
                        <td style={td}>{r.plan_name || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.invoice_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#7c3aed" }}>{r.receipt_no || "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(r.premium)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f0fdf4", fontWeight: 700 }}>
                      <td style={td} colSpan={7}>รวม {g.items.length} รายการ</td>
                      <td style={{ ...td, textAlign: "right", color: "#065f46" }}>{fmt(g.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
        );
      })}

      {editPay && (
        <PaymentDialog payForm={payForm} setPayForm={setPayForm} vendors={vendors} bankAccounts={bankAccounts}
          onVendorChange={onEditVendorChange} totalSum={editPay.total} onClose={() => setEditPay(null)}
          onSave={submitEdit} saving={saving} numDocs={editPay.items.length}
          title={`✏️ แก้ไขใบจ่าย ${editPay.paid_doc_no}`} />
      )}
    </div>
  );
}

/* ======================== TAB: เงินชำระเกิน รอโอนคืน ======================== */
function OverpaidPanel({ currentPlan, setMessage, currentUser }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_cosmos_paid" }),
      });
      const text = await res.text();
      const rows = text ? JSON.parse(text) : [];
      // group by paid_doc_no — เอาเฉพาะใบที่มีชำระเกิน
      const g = {};
      (Array.isArray(rows) ? rows : []).forEach(r => {
        if (!r?.paid_doc_no || !(Number(r.overpaid_amount) > 0)) return;
        if (!g[r.paid_doc_no]) g[r.paid_doc_no] = {
          paid_doc_no: r.paid_doc_no, paid_at: r.paid_at, paid_to_vendor: r.paid_to_vendor,
          overpaid_amount: Number(r.overpaid_amount || 0),
          paid_transfer_amount: Number(r.paid_transfer_amount || 0),
          refunded_at: r.overpaid_refunded_at, refund_note: r.overpaid_refund_note,
          refund_account_id: r.overpaid_refund_account_id || null,
          items: 0,
        };
        g[r.paid_doc_no].items += 1;
      });
      setGroups(Object.values(g).sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || ""))));
    } catch { setGroups([]); }
    setLoading(false);
  }

  // modal เลือกวันที่รับเงินคืน (แทน prompt พิมพ์เอง)
  const [refundModal, setRefundModal] = useState(null); // { g, date, saving }

  function markRefunded(g) {
    setRefundModal({ g, date: new Date().toISOString().slice(0, 10), saving: false });
  }

  async function confirmRefund() {
    const { g, date } = refundModal || {};
    if (!g || !date) return;
    setRefundModal(m => ({ ...m, saving: true }));
    // เงินคืน COSMOS เข้าบัญชีไทยพาณิชย์ ป.เปา เสมอ (ไม่ต้องเลือก) — เคสพิเศษใช้ปุ่ม ✏️ แก้บัญชี ทีหลัง
    let refundAccId = 4; // ไทยพาณิชย์ 7393004545 บจ. ป.เปา มอเตอร์เซอร์วิส
    try {
      const ra = await fetch(ACC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) });
      const accs = await ra.json();
      const scb = (Array.isArray(accs) ? accs : []).find(a => String(a.bank_name || "").includes("ไทยพาณิชย์") && String(a.account_name || "").includes("ป.เปา"));
      if (scb) refundAccId = Number(scb.account_id);
    } catch { /* โหลดบัญชีไม่ได้ → ใช้ id 4 ตายตัว */ }
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund_cosmos_overpaid", paid_doc_no: g.paid_doc_no, refunded_date: date, refund_account_id: refundAccId || undefined, refund_note: `บันทึกโดย ${currentUser?.username || currentUser?.name || "system"}` }),
      });
      setMessage(`✅ บันทึกรับเงินคืน ${g.paid_doc_no} (${fmt(g.overpaid_amount)} บาท) แล้ว`);
      setRefundModal(null);
      fetchData();
    } catch (e) { setMessage("❌ " + e.message); setRefundModal(m => m ? { ...m, saving: false } : m); }
  }

  // ยกเลิกสถานะได้รับคืนแล้ว → กลับเป็นรอโอนคืน (movement ขาเข้าในรายงานเคลื่อนไหวบัญชีจะหายด้วย)
  async function cancelRefunded(g) {
    if (!window.confirm(`ยกเลิกสถานะ "ได้รับคืนแล้ว" ของใบ ${g.paid_doc_no}?\n\nยอด ${fmt(g.overpaid_amount)} บาท จะกลับเป็น "รอโอนคืน" และรายการรับเงินคืนจะหายจากรายงานเคลื่อนไหวบัญชี`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund_cosmos_overpaid", op: "cancel", paid_doc_no: g.paid_doc_no }),
      });
      setMessage(`✅ ยกเลิกรับเงินคืน ${g.paid_doc_no} แล้ว — กลับเป็นรอโอนคืน`);
      fetchData();
    } catch (e) { setMessage("❌ " + e.message); }
  }

  // แก้บัญชีที่เงินคืนเข้า (มีผลกับรายงานเคลื่อนไหวบัญชี) — เว้นว่าง = บัญชีเดิมที่จ่ายออก
  async function changeRefundAccount(g) {
    try {
      const ra = await fetch(ACC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) });
      const accs = await ra.json();
      const list = (Array.isArray(accs) ? accs : []).filter(a => a.account_id && a.bank_name && a.bank_name !== "-");
      if (!list.length) { setMessage("❌ โหลดรายชื่อบัญชีไม่ได้"); return; }
      const cur = list.find(a => Number(a.account_id) === Number(g.refund_account_id));
      const curLabel = cur ? `${cur.bank_name} ${cur.account_no || ""} ${cur.account_name || ""}` : "บัญชีเดิมที่จ่ายออก";
      const menu = list.map((a, i) => `${i + 1}. ${a.bank_name} ${a.account_no || ""} ${a.account_name || ""}`).join("\n");
      const pick = window.prompt(`แก้บัญชีที่เงินคืนเข้า — ใบ ${g.paid_doc_no}\nปัจจุบัน: ${curLabel}\n\nพิมพ์หมายเลขบัญชีใหม่ (เว้นว่าง = บัญชีเดิมที่จ่ายออก)\n\n${menu}`);
      if (pick == null) return; // กดยกเลิก = ไม่แก้
      const idx = parseInt(pick);
      const accId = Number.isFinite(idx) && idx >= 1 && idx <= list.length ? Number(list[idx - 1].account_id) : 0;
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund_cosmos_overpaid", op: "update_account", paid_doc_no: g.paid_doc_no, refund_account_id: accId || undefined }),
      });
      setMessage(`✅ แก้บัญชีรับเงินคืน ${g.paid_doc_no} → ${accId ? `${list.find(a => Number(a.account_id) === accId).bank_name} ${list.find(a => Number(a.account_id) === accId).account_no || ""}` : "บัญชีเดิมที่จ่ายออก"}`);
      fetchData();
    } catch (e) { setMessage("❌ " + e.message); }
  }

  const pending = groups.filter(g => !g.refunded_at);
  const done = groups.filter(g => g.refunded_at);
  const pendingSum = pending.reduce((s, g) => s + g.overpaid_amount, 0);

  const renderRow = (g) => (
    <tr key={g.paid_doc_no} style={{ borderTop: "1px solid #e5e7eb", background: g.refunded_at ? "#f0fdf4" : "#fff" }}>
      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#065f46" }}>{g.paid_doc_no}</td>
      <td style={td}>{fmtDate(g.paid_at)}</td>
      <td style={td}>{g.paid_to_vendor || "-"}</td>
      <td style={{ ...td, textAlign: "right" }}>{g.items}</td>
      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.paid_transfer_amount > 0 ? fmt(g.paid_transfer_amount) : "-"}</td>
      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>{fmt(g.overpaid_amount)}</td>
      <td style={td}>
        {g.refunded_at
          ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534" }}>✓ ได้รับคืนแล้ว {fmtDate(g.refunded_at)}</span>
          : <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#fef3c7", color: "#92400e" }}>รอโอนคืน</span>}
      </td>
      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
        {!g.refunded_at ? (
          <button onClick={() => markRefunded(g)}
            style={{ padding: "4px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✓ รับเงินคืนแล้ว</button>
        ) : (
          <>
            <button onClick={() => changeRefundAccount(g)} title="แก้บัญชีที่เงินคืนเข้า"
              style={{ padding: "4px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 6 }}>✏️ แก้บัญชี</button>
            <button onClick={() => cancelRefunded(g)} title="ถอนสถานะได้รับคืนแล้ว กลับเป็นรอโอนคืน"
              style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>🚫 ยกเลิก</button>
          </>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, alignItems: "center" }}>
        <span>💱 รอโอนคืน: <strong style={{ color: "#dc2626" }}>{pending.length}</strong> ใบ · <strong style={{ color: "#dc2626" }}>{fmt(pendingSum)}</strong> บาท</span>
        <span style={{ color: "#166534" }}>✓ ได้รับคืนแล้ว: <strong>{done.length}</strong> ใบ</span>
        <button onClick={fetchData} style={{ ...btn(currentPlan.color), marginLeft: "auto" }}>🔄 รีเฟรช</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
        {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
         groups.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีเงินชำระเกิน</div> :
         <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: currentPlan.color, color: "#fff" }}>
            <tr>
              <th style={th}>ใบจ่าย</th>
              <th style={th}>วันที่จ่าย</th>
              <th style={th}>จ่ายให้</th>
              <th style={{ ...th, textAlign: "right" }}>รายการ</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดโอนจริง</th>
              <th style={{ ...th, textAlign: "right" }}>ชำระเกิน</th>
              <th style={th}>สถานะ</th>
              <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(renderRow)}
            {done.map(renderRow)}
          </tbody>
        </table>}
      </div>

      {/* modal รับเงินคืน — เลือกวันที่จากปฏิทิน เงินเข้าไทยพาณิชย์ ป.เปา อัตโนมัติ */}
      {refundModal && (
        <div onClick={() => !refundModal.saving && setRefundModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 420, maxWidth: "92vw" }}>
            <h3 style={{ margin: "0 0 12px", color: "#059669" }}>💱 รับเงินคืนจาก COSMOS</h3>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
              <div>ใบจ่าย: <b style={{ fontFamily: "monospace" }}>{refundModal.g.paid_doc_no}</b></div>
              <div>ยอดเงินคืน: <b style={{ color: "#dc2626", fontSize: 16 }}>{fmt(refundModal.g.overpaid_amount)}</b> บาท</div>
              <div style={{ marginTop: 4, color: "#065f46" }}>💰 เงินเข้าบัญชี <b>ไทยพาณิชย์ · บจ. ป.เปา</b> อัตโนมัติ (เปลี่ยนทีหลังได้ด้วยปุ่มแก้บัญชี)</div>
            </div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>วันที่ได้รับเงินคืน *</label>
            <input type="date" value={refundModal.date} onChange={e => setRefundModal(m => ({ ...m, date: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmRefund} disabled={refundModal.saving || !refundModal.date}
                style={{ flex: 1, padding: "9px 0", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
                {refundModal.saving ? "กำลังบันทึก..." : "✓ บันทึกรับเงินคืน"}
              </button>
              <button onClick={() => setRefundModal(null)} disabled={refundModal.saving}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================== Components ======================== */
function Table({ rows, loading, selected, toggle, toggleAll, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       rows.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
       <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: color, color: "#fff" }}>
          <tr>
            <th style={{ padding: 10, width: 40, textAlign: "center" }}><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
            <th style={th}>#</th>
            <th style={th}>App No.</th>
            <th style={th}>วันที่</th>
            <th style={th}>ลูกค้า</th>
            <th style={th}>เลขถัง</th>
            <th style={th}>แผน</th>
            <th style={th}>เบี้ย</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: selected.has(r.id) ? "#fef3c7" : "transparent" }}>
              <td style={{ textAlign: "center" }}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color }}>{r.app_no}</td>
              <td style={td}>{fmtDate(r.submitted_at)}</td>
              <td style={td}>{r.customer_name || "-"}</td>
              <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
              <td style={td}>{r.plan_name || "-"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(r.premium)}</td>
            </tr>
          ))}
        </tbody>
      </table>}
    </div>
  );
}

function PaymentDialog({ payForm, setPayForm, vendors, bankAccounts, onVendorChange, totalSum, onClose, onSave, saving, numDocs, title, incomeDocs, onIncomeChange }) {
  const offset = Number(payForm.income_offset_amount) || 0;
  // ยอดที่ต้องโอน vs ยอดโอนที่คีย์เอง (เฉพาะโหมดบันทึกจ่าย — โหมดแก้ไขไม่มีช่องนี้)
  // COSMOS จ่ายเต็มไม่หัก WHT — ยอด WHT ตั้งเป็นชำระเกินรอโอนคืนแทน
  const hasTransferField = payForm.transfer_amount !== undefined;
  const required = Math.round((totalSum - offset) * 100) / 100;
  const keyed = !hasTransferField || payForm.transfer_amount === "" ? required : Number(payForm.transfer_amount) || 0;
  const diff = Math.round((keyed - required) * 100) / 100; // + = ชำระเกิน / − = โอนขาด
  const shortPay = diff < -0.005;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 14px", color: title ? "#b45309" : "#072d6b" }}>{title || "💵 บันทึกจ่ายเงิน"}</h3>
        <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, textAlign: "center" }}>
          <div>📑 ใบวางบิล: <b>{numDocs}</b> ใบ</div>
          <div>💰 ยอดรวม: <b style={{ color: "#dc2626", fontSize: 20 }}>฿ {fmt(totalSum)}</b></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>วันที่จ่าย *</label><input type="date" value={payForm.paid_date} onChange={e => setPayForm(p => ({ ...p, paid_date: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>วิธีจ่าย</label>
            <select value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} style={inp}>
              <option value="โอน">โอน</option><option value="เงินสด">เงินสด</option><option value="เช็ค">เช็ค</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / span 2" }}><label style={lbl}>Vendor *</label>
            <select value={payForm.paid_to_vendor} onChange={e => onVendorChange(e.target.value)} style={inp}>
              <option value="">-- เลือก Vendor --</option>
              {vendors.map(v => <option key={v.vendor_id} value={v.vendor_name}>{v.vendor_name}{v.wht_rate ? ` (${v.wht_rate}%)` : ""}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / span 2" }}><label style={lbl}>หมายเหตุ</label>
            <textarea value={payForm.payment_note} onChange={e => setPayForm(p => ({ ...p, payment_note: e.target.value }))} rows={2} style={inp} />
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6, textAlign: "center" }}>🏦 บัญชีธนาคาร</div>
          <label style={{ ...lbl, color: "#1e40af" }}>โอนจาก (บัญชีบริษัท) *</label>
          <select value={payForm.from_bank_account_id} onChange={e => setPayForm(p => ({ ...p, from_bank_account_id: e.target.value }))} style={inp}>
            <option value="">-- เลือกบัญชี --</option>
            {bankAccounts.map(b => <option key={b.account_id} value={b.account_id}>{b.bank_name} · {b.account_no} · {b.account_name}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6, textAlign: "center" }}>🧾 หักณที่จ่าย</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div><label style={{ fontSize: 11 }}>Base (ประกันรถหาย · ถอด VAT แล้ว)</label><input type="text" value={fmt(payForm.wht_base)} readOnly style={{ ...inp, textAlign: "right" }} /></div>
            <div><label style={{ fontSize: 11 }}>อัตรา %</label><input type="number" step="0.01" value={payForm.wht_rate} onChange={e => { const r = Number(e.target.value)||0; setPayForm(p => ({ ...p, wht_rate: r, wht_amount: Math.round((p.wht_base*r/100)*100)/100 })); }} style={{ ...inp, textAlign: "right" }} /></div>
            <div><label style={{ fontSize: 11 }}>หัก ณ ที่จ่าย</label><input type="number" step="0.01" value={payForm.wht_amount} onChange={e => setPayForm(p => ({ ...p, wht_amount: Number(e.target.value)||0 }))} style={{ ...inp, textAlign: "right", fontWeight: 700, color: "#dc2626" }} /></div>
          </div>
          <div style={{ marginTop: 8, padding: "6px 10px", background: "#fff", borderRadius: 6, fontSize: 13, textAlign: "center" }}>
            ยอดวางบิล: <b>{fmt(totalSum)}</b>{offset > 0 && <> − ตัดรายได้: <b style={{ color: "#7c3aed" }}>{fmt(offset)}</b></>} = ยอดโอนจริง: <b style={{ color: "#059669" }}>{fmt(totalSum - offset)}</b>
          </div>
          {Number(payForm.wht_amount) > 0 && (
            <div style={{ marginTop: 6, padding: "6px 10px", background: "#fffbeb", border: "1px dashed #f59e0b", borderRadius: 6, fontSize: 12, textAlign: "center", color: "#92400e" }}>
              💡 จ่ายเต็มไม่หัก WHT — ยอดหัก ณ ที่จ่าย <b style={{ color: "#dc2626" }}>{fmt(payForm.wht_amount)}</b> จะตั้งเป็น "ชำระเกิน รอโอนคืน" ให้ COSMOS โอนกลับ
            </div>
          )}
        </div>

        {/* ตัดยอดด้วยรายได้อื่น ๆ (income_records ร่าง) — บันทึกรับชำระฝั่งรายได้ให้อัตโนมัติ */}
        {incomeDocs && (
          <div style={{ marginTop: 12, padding: 10, background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6", marginBottom: 6, textAlign: "center" }}>➖ ตัดยอดจากรายได้อื่น ๆ (ส่วนลด/เงินคืน)</div>
            <select value={payForm.income_doc_id || ""} onChange={e => onIncomeChange(e.target.value)} style={inp}>
              <option value="">-- ไม่ตัดรายได้ --</option>
              {incomeDocs.map(d => (
                <option key={d.income_doc_id} value={d.income_doc_id}>
                  {d.income_doc_no} · {d.customer_name || "-"} · {fmt(d.net_to_pay || d.total)} บาท
                </option>
              ))}
            </select>
            {offset > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#5b21b6" }}>
                ✓ จะหัก <b>{fmt(offset)}</b> ออกจากยอดโอน และบันทึกรับชำระใบ <b>{payForm.income_offset_doc_no}</b> (วิธี "หักกลบ") ให้อัตโนมัติ
              </div>
            )}
            {incomeDocs.length === 0 && <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>ไม่มีใบรายได้สถานะร่าง — บันทึกก่อนที่เมนู "บันทึกรายได้อื่น ๆ"</div>}
          </div>
        )}

        {/* ยอดเงินโอนจริง (คีย์เอง) — เกิน = ชำระเกินรอโอนคืน / ขาด = บันทึกไม่ได้ */}
        {hasTransferField && (
          <div style={{ marginTop: 12, padding: 10, background: shortPay ? "#fef2f2" : "#ecfdf5", border: `1px solid ${shortPay ? "#fca5a5" : "#6ee7b7"}`, borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: shortPay ? "#991b1b" : "#065f46", marginBottom: 6, textAlign: "center" }}>💸 ยอดเงินโอน (คีย์ตามที่โอนจริง)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
              <div><label style={{ fontSize: 11 }}>ยอดที่ต้องจ่าย</label><input type="text" value={fmt(required)} readOnly style={{ ...inp, textAlign: "right", background: "#f8fafc" }} /></div>
              <div><label style={{ fontSize: 11 }}>ยอดเงินโอนจริง *</label>
                <input type="number" step="0.01" value={payForm.transfer_amount} placeholder={fmt(required)}
                  onChange={e => setPayForm(p => ({ ...p, transfer_amount: e.target.value }))}
                  style={{ ...inp, textAlign: "right", fontWeight: 700, color: shortPay ? "#dc2626" : "#065f46" }} />
              </div>
            </div>
            <div style={{ marginTop: 8, padding: "6px 10px", background: "#fff", borderRadius: 6, fontSize: 13, textAlign: "center" }}>
              {shortPay ? (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ โอนขาด {fmt(Math.abs(diff))} — บันทึกไม่ได้ (ต้องไม่น้อยกว่ายอดที่ต้องจ่าย)</span>
              ) : diff > 0.005 ? (
                <span>ส่วนต่าง: <b style={{ color: "#dc2626" }}>-{fmt(diff)}</b> → 💱 <b style={{ color: "#7c3aed" }}>เงินชำระเกิน รอโอนคืน {fmt(diff)}</b></span>
              ) : (
                <span style={{ color: "#065f46", fontWeight: 700 }}>✓ ยอดตรงพอดี</span>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 18, textAlign: "right" }}>
          <button onClick={onClose} style={{ ...btn("#9ca3af"), marginRight: 8 }}>ยกเลิก</button>
          <button onClick={onSave} disabled={saving || shortPay} title={shortPay ? "ยอดเงินโอนน้อยกว่ายอดที่ต้องจ่าย" : ""}
            style={{ ...btn(saving || shortPay ? "#9ca3af" : "#059669"), cursor: saving || shortPay ? "not-allowed" : "pointer" }}>{saving ? "..." : "💾 บันทึก"}</button>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "Tahoma" });
