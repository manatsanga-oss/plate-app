import React, { useEffect, useState } from "react";

// ============================================================================
// สรุปยอดเงินมัดจำรายเดือน แยกประเภท (ส่วนท้ายหน้า "สรุปรับชำระเงินทั่วไป (รายเดือน)" — Report for FlowAcc)
// user 2026-11-06: "แสดงสรุปยอดเงินมัดจำ แยกเงินมัดจำแต่ละประเภท รวมทั้งมัดจำป้ายแดง"
// ----------------------------------------------------------------------------
// คอลัมน์ (มุมมองบัญชี "เงินมัดจำรับ" = หนี้สิน): ยกมาต้นเดือน | รับใหม่ | ตัดใช้ (นำไปชำระ) | คืนเงิน | ยึด/ยกเลิก | คงค้างปลายเดือน
// ประเภท / แหล่งข้อมูล:
//   1) มัดจำจองรถ — booking-deposit-api get_deposits (status all): รับ = deposit_date · คืน = refunded_at/refund_amount
//      ตัดใช้ = ใบขาย NEW ที่อ้างใบมัดจำ (retail-sale-api list_retail_sales: bd_deposit_no, booking_deposit) ตามวันที่ขาย
//   2) มัดจำป้ายแดง 200 — retail-sale-api list_red_plate_deposits (status all): รับ = received_date · คืน = refund_date · cancelled = ยกเลิก (ไม่นับรับ)
//   3) มัดจำอะไหล่ บริการ (PDS-) / สั่งซื้อ (PDO-) — part-deposit-api list_deposits: รับ = deposit_date (deposit_amount)
//      คืน = refunded_at/refunded_amount · ตัดใช้ = ส่วนที่ remaining_amount ลดลงโดยไม่ใช่คืนเงิน (ระบบไม่เก็บวันที่ตัด → ใช้ updated_at เป็นวันตัด โดยประมาณ)
//   4) ยึดมัดจำ (ใบมัดจำ NIDS/DMS ที่ลูกค้าไม่มารับ) — spare-parts-api list_deposit_seizures: seizure_date/seizure_amount แสดงเฉพาะคอลัมน์ยึด
// ยอดยกมา/คงค้าง คำนวณย้อนจากเอกสารทั้งหมด (ไม่มีตาราง balance) จึงเป็นยอดตามเอกสารในระบบ ไม่ใช่ยอดบัญชี Flow
// ============================================================================

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
const fmt = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d10 = (v) => String(v || "").slice(0, 10);
const r2 = (v) => Math.round(num(v) * 100) / 100;
async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = (await res.text()).trim(); if (!t) return [];
  let d; try { d = JSON.parse(t); } catch { return []; }
  if (!Array.isArray(d)) d = d?.rows || d?.data || [d];
  if (d[0] && typeof d[0].listjson === "string") { try { d = JSON.parse(d[0].listjson); } catch { d = []; } }
  return Array.isArray(d) ? d.filter(Boolean) : [];
}
const monthRange = (ym) => { const [y, m] = ym.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`]; };
const prevDay = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const thDate = (iso) => { if (!iso) return "-"; const [y, m, d] = iso.split("-").map(Number); return `${d}/${m}/${y + 543}`; };

// รวมยอดตามช่วง: in = รายการ (date, amount) · นับ "ก่อน from" เป็นยกมา, "ใน [from,to]" เป็นงวด
function bucket(events, from, to) {
  const o = { before: 0, inPeriod: 0, upTo: 0 };
  events.forEach(([d, a]) => { if (!d) return; const v = num(a); if (d < from) o.before += v; if (d >= from && d <= to) o.inPeriod += v; if (d <= to) o.upTo += v; });
  return o;
}

export default function DepositSummarySection({ ym, branchFilter = "" }) {
  const [state, setState] = useState({ loading: false, rows: null, err: "", detail: null });
  const [loadedYm, setLoadedYm] = useState("");

  async function load() {
    if (!ym) return;
    setState((s) => ({ ...s, loading: true, err: "" }));
    const [from, to] = monthRange(ym); const prev = prevDay(from);
    try {
      const [booking, sales, redPlate, parts, seizures] = await Promise.all([
        post(`${BASE}/booking-deposit-api`, { action: "get_deposits", keyword: "", status: "all" }),
        post(`${BASE}/retail-sale-api`, { action: "list_retail_sales", date_from: "2026-01-01", date_to: to, limit: 5000 }),
        post(`${BASE}/retail-sale-api`, { action: "list_red_plate_deposits", status: "all" }),
        post(`${BASE}/part-deposit-api`, { action: "list_deposits", limit: 5000 }),
        post(`${BASE}/spare-parts-api`, { action: "list_deposit_seizures" }).catch(() => []),
      ]);
      const brOk = (code) => !branchFilter || String(code || "").toUpperCase().startsWith(branchFilter.toUpperCase());

      // ---- 1) มัดจำจองรถ ----
      const bk = booking.filter((x) => x && x.deposit_no && brOk(x.branch_code));
      const bkRecv = bk.map((x) => [d10(x.deposit_date), x.deposit_amount]);
      const bkRef = bk.filter((x) => x.status === "refunded" || num(x.refund_amount) > 0).map((x) => [d10(x.refunded_at || x.updated_at), num(x.refund_amount) || num(x.deposit_amount)]);
      const usedSales = sales.filter((x) => x && x.bd_deposit_no && x.sale_status !== "cancelled" && num(x.booking_deposit) > 0 && brOk(x.branch_code));
      const bkUsed = usedSales.map((x) => [d10(x.sale_date), x.booking_deposit]);
      // ใบขายที่ตัดมัดจำแต่ไม่ได้อ้างใบ DEP- (มัดจำระบบเก่า/ไม่ได้ผูก) — ไม่หักจากยอดคงค้างของใบ DEP- แต่แจ้งไว้ให้บัญชีเห็น
      const unlinked = sales.filter((x) => x && !x.bd_deposit_no && x.sale_status !== "cancelled" && num(x.booking_deposit) > 0 && brOk(x.branch_code) && d10(x.sale_date) >= from && d10(x.sale_date) <= to);
      const unlinkedAmt = r2(unlinked.reduce((t, x) => t + num(x.booking_deposit), 0));
      const B = { recv: bucket(bkRecv, from, to), used: bucket(bkUsed, from, to), ref: bucket(bkRef, from, to) };
      const rowBooking = { type: "มัดจำจองรถ", doc: "DEP-", opening: r2(B.recv.before - B.used.before - B.ref.before), recv: r2(B.recv.inPeriod), used: r2(B.used.inPeriod), refund: r2(B.ref.inPeriod), seized: 0,
        closing: r2(B.recv.upTo - B.used.upTo - B.ref.upTo), n_recv: bkRecv.filter(([d]) => d >= from && d <= to).length, n_used: bkUsed.filter(([d]) => d >= from && d <= to).length, n_ref: bkRef.filter(([d]) => d >= from && d <= to).length,
        note: "ตัดใช้ = ใบขาย NEW ที่อ้างใบมัดจำ DEP- ตามวันที่ขาย" + (unlinkedAmt ? ` · ใบขายที่ตัดมัดจำโดยไม่อ้างใบ DEP- อีก ${fmt(unlinkedAmt)} (${unlinked.length} ใบ มัดจำระบบเก่า ไม่หักจากคงค้างนี้)` : "") };

      // ---- 2) มัดจำป้ายแดง ----
      const rp = redPlate.filter((x) => x && x.deposit_no && x.status !== "cancelled" && brOk(x.branch_code));
      const rpRecv = rp.map((x) => [d10(x.received_date), x.amount]);
      const rpRef = rp.filter((x) => x.status === "refunded" || num(x.refund_amount) > 0).map((x) => [d10(x.refund_date || x.updated_at), num(x.refund_amount) || num(x.amount)]);
      const rpCancel = redPlate.filter((x) => x && x.status === "cancelled" && brOk(x.branch_code)).map((x) => [d10(x.updated_at || x.received_date), x.amount]);
      const R = { recv: bucket(rpRecv, from, to), ref: bucket(rpRef, from, to), can: bucket(rpCancel, from, to) };
      const rowRed = { type: "มัดจำป้ายแดง (200)", doc: "RPD-/RPR-", opening: r2(R.recv.before - R.ref.before), recv: r2(R.recv.inPeriod), used: 0, refund: r2(R.ref.inPeriod), seized: 0,
        closing: r2(R.recv.upTo - R.ref.upTo), n_recv: rpRecv.filter(([d]) => d >= from && d <= to).length, n_used: 0, n_ref: rpRef.filter(([d]) => d >= from && d <= to).length,
        note: `คืนเมื่อลูกค้าคืนป้ายแดง · ใบยกเลิกไม่นับ (${rpCancel.filter(([d]) => d >= from && d <= to).length} ใบในเดือนนี้)` };

      // ---- 3) มัดจำอะไหล่ บริการ / สั่งซื้อ ----
      const partRow = (label, pred, doc) => {
        const list = parts.filter((x) => x && x.deposit_doc_no && pred(x) && x.status !== "cancelled" && !x.cancelled_at && brOk(x.branch_code));
        const recv = list.map((x) => [d10(x.deposit_date), x.deposit_amount]);
        const ref = list.filter((x) => num(x.refunded_amount) > 0).map((x) => [d10(x.refunded_at || x.updated_at), x.refunded_amount]);
        // ตัดใช้ = มัดจำ − คงเหลือ − คืน (เฉพาะที่ > 0) ลงวันที่ updated_at (ระบบไม่เก็บวันตัด)
        const used = list.map((x) => [d10(x.updated_at || x.deposit_date), Math.max(num(x.deposit_amount) - num(x.remaining_amount) - num(x.refunded_amount), 0)]).filter(([, a]) => a > 0.004);
        const P = { recv: bucket(recv, from, to), used: bucket(used, from, to), ref: bucket(ref, from, to) };
        return { type: label, doc, opening: r2(P.recv.before - P.used.before - P.ref.before), recv: r2(P.recv.inPeriod), used: r2(P.used.inPeriod), refund: r2(P.ref.inPeriod), seized: 0,
          closing: r2(P.recv.upTo - P.used.upTo - P.ref.upTo), n_recv: recv.filter(([d]) => d >= from && d <= to).length, n_used: used.filter(([d]) => d >= from && d <= to).length, n_ref: ref.filter(([d]) => d >= from && d <= to).length,
          note: "วันตัดใช้ = วันที่ปรับปรุงใบมัดจำล่าสุด (โดยประมาณ)" };
      };
      const rowPDS = partRow("มัดจำอะไหล่ งานบริการ", (x) => /บริการ/.test(String(x.deposit_type || "")) || /^PDS/i.test(String(x.deposit_doc_no || "")), "PDS-");
      const rowPDO = partRow("มัดจำอะไหล่ สั่งซื้อ", (x) => !(/บริการ/.test(String(x.deposit_type || "")) || /^PDS/i.test(String(x.deposit_doc_no || ""))), "PDO-");

      // ---- 4) ยึดมัดจำ (NIDS/DMS) ----
      const sz = seizures.filter((x) => x && x.status !== "cancelled");
      const szEv = sz.map((x) => [d10(x.seizure_date), x.seizure_amount]);
      const S = bucket(szEv, from, to);
      const rowSeize = { type: "ยึดมัดจำ ลูกค้าไม่มารับ (ใบมัดจำ NIDS/DMS)", doc: "REC-", opening: null, recv: null, used: null, refund: null, seized: r2(S.inPeriod), closing: null, n_recv: 0, n_used: 0, n_ref: szEv.filter(([d]) => d >= from && d <= to).length,
        note: "รับรู้เป็นรายได้อื่น (เคลียร์มัดจำเก่า) · ตัวใบมัดจำอยู่ในระบบ DMS/NIDS ไม่ได้บันทึกรับในระบบนี้" };

      const rows = [rowBooking, rowRed, rowPDS, rowPDO, rowSeize];
      setState({ loading: false, rows, err: "", detail: { from, to, prev, usedSales: usedSales.filter((x) => d10(x.sale_date) >= from && d10(x.sale_date) <= to) } });
      setLoadedYm(ym);
    } catch (e) { setState({ loading: false, rows: null, err: "❌ โหลดสรุปเงินมัดจำไม่สำเร็จ: " + (e?.message || e), detail: null }); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ym, branchFilter]);

  const rows = state.rows || [];
  const tot = (k) => rows.reduce((s, r) => s + (r[k] == null ? 0 : num(r[k])), 0);
  const th = { padding: "7px 10px", fontSize: 12.5, fontWeight: 700, color: "#334155", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", textAlign: "right" };
  const td = { padding: "6px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
  const nc = { ...td, textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };
  const cell = (v, color) => (v == null ? <span style={{ color: "#cbd5e1" }}>—</span> : <span style={{ color: num(v) ? color : "#9ca3af", fontWeight: num(v) ? 600 : 400 }}>{fmt(v)}</span>);
  const [from, to] = ym ? monthRange(ym) : ["", ""];

  return (
    <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1e3a8a" }}>💰 สรุปยอดเงินมัดจำ แยกประเภท</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>รอบ {thDate(from)} – {thDate(to)} · ยกมา = คงค้าง ณ {thDate(state.detail?.prev || (from ? prevDay(from) : ""))} · หน่วย: บาท{branchFilter ? ` · เฉพาะสาขา ${branchFilter}` : ""}</div>
        <div style={{ flex: 1 }} />
        <button onClick={load} disabled={state.loading} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontFamily: "Tahoma", fontSize: 12 }}>{state.loading ? "กำลังโหลด…" : "🔄 โหลดใหม่"}</button>
      </div>
      {state.err && <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>{state.err}</div>}
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>ประเภทเงินมัดจำ</th>
              <th style={th}>ยกมา (คงค้างต้นเดือน)</th>
              <th style={{ ...th, background: "#f0fdf4" }}>รับใหม่</th>
              <th style={{ ...th, background: "#fff7ed" }}>ตัดใช้ชำระ</th>
              <th style={{ ...th, background: "#fef2f2" }}>คืนเงิน</th>
              <th style={{ ...th, background: "#f5f3ff" }}>ยึด</th>
              <th style={th}>คงค้างปลายเดือน</th>
            </tr>
          </thead>
          <tbody>
            {state.loading && !rows.length && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 20 }}>กำลังโหลดเงินมัดจำ…</td></tr>}
            {rows.map((r) => (
              <tr key={r.type} title={r.note}>
                <td style={td}><div style={{ fontWeight: 600 }}>{r.type} <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{r.doc}</span></div><div style={{ fontSize: 11, color: "#94a3b8" }}>{r.note}</div></td>
                <td style={nc}>{cell(r.opening, "#334155")}</td>
                <td style={{ ...nc, background: "#f7fef9" }}>{cell(r.recv, "#15803d")}{r.n_recv ? <div style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: "Tahoma" }}>{r.n_recv} ใบ</div> : null}</td>
                <td style={{ ...nc, background: "#fffaf5" }}>{cell(r.used, "#c2410c")}{r.n_used ? <div style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: "Tahoma" }}>{r.n_used} ใบ</div> : null}</td>
                <td style={{ ...nc, background: "#fff7f7" }}>{cell(r.refund, "#b91c1c")}{r.n_ref && r.refund != null ? <div style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: "Tahoma" }}>{r.n_ref} ใบ</div> : null}</td>
                <td style={{ ...nc, background: "#faf8ff" }}>{cell(r.seized, "#6d28d9")}{r.seized && r.n_ref ? <div style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: "Tahoma" }}>{r.n_ref} ใบ</div> : null}</td>
                <td style={{ ...nc, fontWeight: 700 }}>{cell(r.closing, "#1d4ed8")}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                <td style={td}>รวมเงินมัดจำ (ไม่รวมแถวยึด)</td>
                <td style={nc}>{fmt(tot("opening"))}</td><td style={nc}>{fmt(tot("recv"))}</td><td style={nc}>{fmt(tot("used"))}</td><td style={nc}>{fmt(tot("refund"))}</td><td style={nc}>{fmt(tot("seized"))}</td><td style={nc}>{fmt(tot("closing"))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
        สูตร: คงค้างปลายเดือน = ยกมา + รับใหม่ − ตัดใช้ − คืนเงิน · คำนวณจากเอกสารมัดจำในระบบทั้งหมดย้อนหลัง (ใบที่ยกเลิกไม่นับ) ไม่ใช่ยอดบัญชี Flow ·
        แถวรับใหม่ของมัดจำจองรถ/ป้ายแดง/อะไหล่ ตรงกับกลุ่ม "เงินมัดจำ" ในตารางรับชำระด้านบน ส่วนตัดใช้ตรงกับวิธีรับเงิน "เงินมัดจำ (ตัดมัดจำ)" · ยอดยึดมัดจำเป็นรายได้อื่น ไม่อยู่ในยอดคงค้าง
        {loadedYm && loadedYm !== ym ? ` · (แสดงรอบ ${loadedYm} อยู่)` : ""}
      </div>
    </div>
  );
}
