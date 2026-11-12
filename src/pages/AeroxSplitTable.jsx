import React from "react";
import { aeroxCampaignResult, thaiLongDate } from "../utils/aeroxCampaign";

// ตารางแบ่งค่าคอมแคมเปญรายใบขาย — เฉลี่ยให้พนักงานมีสิทธิ์ค่าคอมพิเศษที่มาทำงานจริงในวันขาย (ผลจาก loadAeroxSplit)
// ใช้ร่วม: เมนู HR "ค่าคอมพิเศษเฉพาะรุ่น" (ModelSpecialCommissionPage) และ POP UP ประกาศผล (AeroxResultPopup) — user 2026-11-12
const fmt = (n) => Number(n || 0).toLocaleString("th-TH");
const fmt2 = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const th = { padding: "6px 8px", fontSize: 12.5, background: "#f1f5f9", border: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap", textAlign: "left" };
const td = { padding: "6px 8px", fontSize: 13, border: "1px solid #e2e8f0" };
const warn = { padding: "8px 10px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12.5, color: "#92400e", marginBottom: 8 };

export default function AeroxSplitTable({ data, split, hrNote = true }) {
  const { campaign, tier, rate, allStdOk, payable, payoutDate } = aeroxCampaignResult(data);
  const months = campaign.months;
  const amtColor = payable ? "#15803d" : "#b91c1c";
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>แบ่งค่าคอมรายใบขาย — เฉลี่ยให้พนักงานที่มีสิทธิ์ค่าคอมพิเศษของวันขาย ({tier ? `${fmt(rate)} บาท/คัน` : "—"})</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
        รถ 1 คัน = {fmt(rate)} บาท หารเท่ากันให้พนักงานที่มีสิทธิ์ค่าคอมพิเศษของสาขาที่ขาย เฉพาะคนที่ <b>มาทำงานจริงในวันขาย</b> — ทุกสาขารวม SCY01 (มีสแกนเข้า หรือสถานะ "มา" ในบันทึกเวลาทำงาน · วันหยุดประจำสัปดาห์และวันลาไม่นับ)
      </div>
      {split?.mode === "attendance-dayoff" && (
        <div style={warn}>⚠️ ตอนนี้ยังนับวันหยุดประจำสัปดาห์ว่ามาทำงาน — รอ re-import workflow Sales Extra Pay API รอบล่าสุด เพื่อนับเฉพาะวันที่มาทำงานจริง</div>
      )}
      {split?.mode === "legacy" && (
        <div style={warn}>⚠️ ยังใช้รายชื่อแบบเดิมชั่วคราว (SCY01 หารทุกคนที่มีสิทธิ์ ไม่ดูวันทำงาน) — รอ re-import workflow Sales Extra Pay API เพื่อให้ SCY01 นับเฉพาะคนที่มาทำงานวันขาย</div>
      )}
      {!split ? <div style={{ color: "#b91c1c", fontSize: 13 }}>โหลดรายชื่อผู้มีสิทธิ์ค่าคอมพิเศษไม่สำเร็จ — ลองใหม่อีกครั้ง</div> : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>
            <th style={th}>พนักงาน</th><th style={th}>ร้าน</th><th style={{ ...th, textAlign: "right" }}>ร่วมแบ่ง (ใบ)</th>
            {months.map((m) => <th key={m.ym} style={{ ...th, textAlign: "right" }}>{m.label} (บาท)</th>)}
            <th style={{ ...th, textAlign: "right" }}>เทียบเท่า (คัน)</th><th style={{ ...th, textAlign: "right" }}>ส่วนแบ่งรวม (บาท)</th>
          </tr></thead>
          <tbody>
            {split.employees.length === 0 && <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={months.length + 5}>ยังไม่มีรายการ</td></tr>}
            {split.employees.map((x) => (
              <tr key={x.id}>
                <td style={td}>{x.name}</td>
                <td style={td}>{x.branches.join(", ")}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmt(x.cars)}</td>
                {months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right" }}>{fmt2(x.byMonth[m.ym]?.amount || 0)}</td>)}
                <td style={{ ...td, textAlign: "right" }}>{fmt2(x.share)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: amtColor }}>{fmt2(x.amount)}</td>
              </tr>
            ))}
            {split.unallocated.length > 0 && (
              <tr style={{ background: "#fef2f2" }}>
                <td style={{ ...td, color: "#b91c1c" }} colSpan={months.length + 3} title={split.unallocated.join(", ")}>ยังแบ่งไม่ได้ — ไม่พบพนักงานมีสิทธิ์ที่มาทำงานวันขาย ({split.unallocated.length} ใบ: {split.unallocated.join(", ")})</td>
                <td style={{ ...td, textAlign: "right" }}>{fmt2(split.unallocated.length)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{fmt2(split.unallocatedAmount)}</td>
              </tr>
            )}
            {split.employees.length > 0 && (
              <tr style={{ background: "#fef9c3" }}>
                <td style={{ ...td, fontWeight: 800 }} colSpan={3}>รวม</td>
                {months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt2(split.employees.reduce((t, x) => t + (x.byMonth[m.ym]?.amount || 0), 0))}</td>)}
                <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt2(split.employees.reduce((t, x) => t + x.share, 0) + split.unallocated.length)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 800, color: amtColor }}>{fmt2(split.employees.reduce((t, x) => t + x.amount, 0) + split.unallocatedAmount)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 8 }}>
        * ยอดตามกติกาแคมเปญ (ค่าคอมต่อคันของยอดรวมทุกร้าน)
        {payoutDate ? ` · กำหนดเงินเข้า ${thaiLongDate(payoutDate)}` : allStdOk ? "" : " — แคมเปญนี้ยังไม่ผ่านเงื่อนไข STD ครบทุกเดือน ยอดจึงแสดงเป็นสีแดง (ยังไม่ได้รับจริง)"}
        {hrNote ? " · หน้านี้แสดงผลอย่างเดียว ยังไม่ได้ผูกเข้าเอกสารจ่ายค่าคอม" : ""}
      </div>
    </div>
  );
}
