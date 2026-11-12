import React, { useEffect, useState } from "react";
import { AeroxCampaignBody } from "./AeroxCampaignPopup";
import AeroxSplitTable from "./AeroxSplitTable";
import { AEROX_CAMPAIGNS, aeroxCampaignByKey, aeroxCampaignResult, loadAeroxCampaign, loadAeroxSplit, thaiLongDate } from "../utils/aeroxCampaign";

// ============================================================================
// HR → ค่าคอมพิเศษเฉพาะรุ่น (user 2026-11-12)
// แสดงผลแคมเปญค่าคอมพิเศษรายรุ่น — AEROX STEP COMMISSION ทุกรอบใน AEROX_CAMPAIGNS (ก.ย.–ต.ค. 2569 · ต่อแคมเปญ พ.ย.–ธ.ค. 2569)
// ใช้ตัวคำนวณเดียวกับ POP UP (loadAeroxCampaign / AeroxCampaignBody) + ตารางแบ่งค่าคอมรายใบขายเฉลี่ยให้พนักงานมีสิทธิ์ค่าคอมพิเศษ
// ที่มาทำงานจริงวันขาย (loadAeroxSplit / AeroxSplitTable) + ยอดขายตามผู้ขาย + รายการรายคัน
// แคมเปญรอบ/รุ่นใหม่: เพิ่ม config ใน utils/aeroxCampaign.js (AEROX_CAMPAIGNS) รายการในหน้านี้ขึ้นเอง
// ============================================================================
const LOGIN_API = "https://n8n-new-project-gwf2.onrender.com/webhook/office-login";

const fmt = (n) => Number(n || 0).toLocaleString("th-TH");
const fmt2 = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v) => { const s = String(v || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "-"; const [y, m, d] = s.split("-"); return `${d}/${m}/${Number(y) + 543}`; };
const th = { padding: "6px 8px", fontSize: 12.5, background: "#f1f5f9", border: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap", textAlign: "left" };
const td = { padding: "6px 8px", fontSize: 13, border: "1px solid #e2e8f0" };
const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 14 };

export default function ModelSpecialCommissionPage() {
  const [campaignKey, setCampaignKey] = useState(AEROX_CAMPAIGNS[0].key);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [split, setSplit] = useState(null);   // ผลแบ่งค่าคอมรายใบขายให้พนักงานมีสิทธิ์ (null = โหลดไม่ได้)
  const [names, setNames] = useState({}); // username → ชื่อพนักงาน
  const [loadedAt, setLoadedAt] = useState("");
  const campaign = aeroxCampaignByKey(campaignKey);

  async function load(key = campaignKey) {
    setLoading(true); setErr("");
    try {
      const d = await loadAeroxCampaign(aeroxCampaignByKey(key));
      setData(d);
      // แบ่งค่าคอมต่อคัน (step ของยอดรวม) เฉลี่ยให้พนักงานมีสิทธิ์ค่าคอมพิเศษของวันขาย — โหลดไม่ได้ก็ยังแสดงส่วนอื่น
      try { setSplit(await loadAeroxSplit(d, aeroxCampaignResult(d).rate)); } catch { setSplit(null); }
      setLoadedAt(new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }));
    } catch { setErr("โหลดยอดขายไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { load(campaignKey); /* eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */ }, [campaignKey]);
  useEffect(() => {
    // ชื่อเต็มของพนักงานขาย (ใบขายเก็บ username) — โหลดไม่ได้ก็แสดง username ตามเดิม
    fetch(LOGIN_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_users" }) })
      .then((r) => r.json()).then((d) => {
        const m = {};
        (Array.isArray(d?.data) ? d.data : []).forEach((u) => { if (u?.username) m[String(u.username).toUpperCase()] = u.name || u.username; });
        setNames(m);
      }).catch(() => {});
  }, []);

  const { total, rate } = aeroxCampaignResult(data);
  const nameOf = (u) => names[String(u || "").toUpperCase()] || u || "-";
  const today = new Date().toLocaleDateString("en-CA");
  const ended = today > campaign.to;
  const months = campaign.months;

  return (
    <div style={{ fontFamily: "Tahoma", maxWidth: 1150, margin: "0 auto" }}>
      <h2 style={{ margin: "4px 0 10px" }}>🏁 ค่าคอมพิเศษเฉพาะรุ่น</h2>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#4b5563" }}>แคมเปญ</span>
        <select value={campaignKey} onChange={(e) => setCampaignKey(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "Tahoma" }}>
          {AEROX_CAMPAIGNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={() => load()} disabled={loading} style={{ padding: "8px 14px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "Tahoma" }}>{loading ? "กำลังโหลด…" : "🔄 รีเฟรช"}</button>
        <span style={{ fontSize: 12.5, padding: "4px 10px", borderRadius: 999, background: ended ? "#e5e7eb" : "#dcfce7", color: ended ? "#374151" : "#166534", fontWeight: 700 }}>{ended ? "แคมเปญสิ้นสุดแล้ว — ยอดสรุปสุดท้าย" : "แคมเปญกำลังดำเนินอยู่"}</span>
        {campaign.payoutDate && <span style={{ fontSize: 12.5, padding: "4px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>💰 เงินเข้า {thaiLongDate(campaign.payoutDate)}</span>}
        {loadedAt && <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>ข้อมูล ณ {loadedAt}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>
        ระยะเวลา {campaign.periodLabel} · นับจากใบขายระบบ (YAMAHA Aerox ทุกร้าน ไม่รวมใบยกเลิก/ขายส่ง) · ชุดข้อมูลเดียวกับ POP UP ที่ขึ้นตอนเข้าระบบ
      </div>

      {loading ? <div style={{ ...card, textAlign: "center", color: "#64748b" }}>⏳ กำลังคำนวณยอด…</div> : err ? <div style={{ ...card, color: "#b91c1c" }}>{err}</div> : (
        <>
          <div style={card}><AeroxCampaignBody data={data} /></div>

          <div style={card}><AeroxSplitTable data={data} split={split} /></div>

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>ยอดขายตามผู้ขายในใบขาย (คัน)</div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>
                <th style={th}>พนักงานขาย</th><th style={th}>ร้าน</th>
                {months.map((m) => <th key={m.ym} style={{ ...th, textAlign: "right" }}>{m.label}</th>)}
                <th style={{ ...th, textAlign: "right" }}>รวม (คัน)</th>
              </tr></thead>
              <tbody>
                {(data?.sellers || []).length === 0 && <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={months.length + 3}>ยังไม่มียอดขาย Aerox ในช่วงแคมเปญ</td></tr>}
                {(data?.sellers || []).map((x) => (
                  <tr key={x.seller}>
                    <td style={td}>{nameOf(x.seller)}{nameOf(x.seller) !== x.seller ? <span style={{ color: "#9ca3af", fontSize: 11.5 }}> ({x.seller})</span> : null}</td>
                    <td style={td}>{x.branches.join(", ")}</td>
                    {months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right" }}>{fmt(x.byMonth[m.ym] || 0)}</td>)}
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(x.units)}</td>
                  </tr>
                ))}
                {(data?.sellers || []).length > 0 && (
                  <tr style={{ background: "#fef9c3" }}>
                    <td style={{ ...td, fontWeight: 800 }} colSpan={2}>รวม</td>
                    {months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt(data.byMonth[m.ym] || 0)}</td>)}
                    <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt(total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>รายการรถที่นับเข้าแคมเปญ ({fmt(total)} คัน)</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr>
                  <th style={th}>#</th><th style={th}>วันที่ขาย</th><th style={th}>เลขที่ใบขาย</th><th style={th}>ร้าน</th><th style={th}>พนักงานขาย</th><th style={th}>ลูกค้า</th>
                  <th style={th}>รุ่น / สี</th><th style={th}>เลขตัวถัง</th><th style={th}>เลขเครื่อง</th><th style={th}>ประเภทขาย</th><th style={{ ...th, textAlign: "right" }}>ราคาสุทธิ</th><th style={th}>ผู้ร่วมแบ่งค่าคอม</th><th style={{ ...th, textAlign: "right" }}>ต่อคน (บาท)</th>
                </tr></thead>
                <tbody>
                  {(data?.sales || []).map((r, i) => {
                    const who = split?.byInvoice?.[String(r.invoice_no)] || [];
                    return (
                      <tr key={r.invoice_no}>
                        <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.sale_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.invoice_no}</td>
                        <td style={td}>{String(r.branch_code || "").slice(0, 5)}</td>
                        <td style={td}>{nameOf(r.seller)}</td>
                        <td style={td}>{r.customer_name || "-"}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{r.model_name || r.model_code || "-"}{r.model_color ? ` / ${r.model_color}` : ""}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no || "-"}</td>
                        <td style={td}>{r.finance_type && r.finance_type !== "none" ? (r.finance_company_name || "ไฟแนนซ์") : "เงินสด"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt2(r.net_car_price)}</td>
                        <td style={{ ...td, fontSize: 12, minWidth: 220, color: who.length ? "#111827" : "#b91c1c" }}>{who.length ? `${who.length} คน: ${who.map((e) => e.name).join(", ")}` : (split ? "ไม่พบผู้มีสิทธิ์ที่มาทำงาน" : "-")}</td>
                        <td style={{ ...td, textAlign: "right" }}>{who.length ? fmt2(rate / who.length) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
