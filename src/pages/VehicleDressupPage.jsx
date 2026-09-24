import React, { useEffect, useMemo, useState } from "react";

// บันทึกอะไหล่แต่งรถสำหรับขาย (user 2026-09-24)
// เลือกรถในสต๊อก → เลือกอะไหล่จากสต๊อกอะไหล่หมุนเร็ว (ทุน = ราคา/หน่วยจากไฟล์สินค้าคงเหลือ) → แก้ราคาขายรายชิ้นหรือยอดรวม
// หน้าบันทึกขาย NEW ดึงตามเลขเครื่อง: บวกยอดรวมเข้าราคาขาย + ป้าย "รถแต่ง" + โชว์รายการเป็นของแถม แล้ว mark_used ตอนขาย
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/vehicle-dressup-api";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const FM_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return {}; }
}
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const text = (v) => String(v == null ? "" : v).trim();
const thaiDate = (iso) => {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : s;
};
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };
const STATUS_TH = { active: "รอใช้ขาย", used: "ใช้ขายแล้ว", cancelled: "ยกเลิก", replaced: "ถูกแทนที่" };
// อะไหล่ที่ใช้แต่งรถ = เฉพาะกลุ่มในแท็บ "หมวกและอะไหล่ตกแต่ง" (user 2026-09-24)
const DRESSUP_GROUPS = ["PG-032", "PG-033"];
const isDressupPart = (p) => DRESSUP_GROUPS.some((g) => String(p?.product_group || "").toUpperCase().startsWith(g));

export default function VehicleDressupPage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  // ---- รถจากสต๊อก ----
  const [kw, setKw] = useState("");
  const [veh, setVeh] = useState(null);
  const [searching, setSearching] = useState(false);
  async function searchVehicle() {
    const q = kw.trim();
    if (!q || searching) return;
    setSearching(true); setMessage(""); setVeh(null);
    try {
      const d = await post(RETAIL_API, { action: "get_vehicle", keyword: q });
      const v = Array.isArray(d) ? d[0] : d;
      if (!v || !v.engine_no) throw new Error("ไม่พบรถคันนี้ในสต๊อก (ค้นด้วยเลขเครื่องหรือเลขถัง)");
      if (v.sold_at) throw new Error(`รถคันนี้ขายแล้ว (${v.sold_invoice_no || ""} · ${thaiDate(v.sold_at)}) — บันทึกได้เฉพาะคันที่ยังไม่ขาย`);
      setVeh(v);
      // มีรายการแต่งค้างอยู่ → โหลดมาให้แก้ต่อ (บันทึกใหม่จะแทนที่ของเดิม)
      const prev = rows.find((r) => r.status === "active" && text(r.engine_no).toUpperCase() === text(v.engine_no).toUpperCase());
      if (prev) {
        setItems((prev.items || []).map((it) => ({ part_id: it.part_id, part_code: it.part_code, part_name: it.part_name, qty: num(it.qty) || 1, unit_cost: num(it.unit_cost), unit_price: String(num(it.unit_price)) })));
        setTotalOverride(num(prev.total_price) > 0 ? String(num(prev.total_price)) : ""); setNote(prev.note || "");
        setMessage(`ℹ️ รถคันนี้มีรายการแต่งบันทึกไว้แล้ว (#${prev.id}) — แก้แล้วกดบันทึกจะแทนที่ของเดิม`);
      } else { setItems([]); setTotalOverride(""); setNote(""); }
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    setSearching(false);
  }

  // ---- อะไหล่จากสต๊อกหมุนเร็ว ----
  const [parts, setParts] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [pkw, setPkw] = useState("");
  const [pgroup, setPgroup] = useState("all");
  useEffect(() => {
    setPartsLoading(true);
    post(FM_API, { action: "list" }).then((d) => setParts((Array.isArray(d) ? d : []).filter((r) => r && r.id && isDressupPart(r)))).catch(() => setParts([])).finally(() => setPartsLoading(false));
  }, []);
  const groups = useMemo(() => [...new Set(parts.map((p) => p.product_group).filter(Boolean))].sort(), [parts]);
  const partHits = useMemo(() => {
    const q = pkw.trim().toLowerCase(); const qn = q.replace(/-/g, "");
    return parts.filter((p) => {
      if (pgroup !== "all" && p.product_group !== pgroup) return false;
      if (!q) return true;
      const code = String(p.part_code || "").toLowerCase();
      return code.includes(q) || code.replace(/-/g, "").includes(qn) || String(p.product_name || p.custom_name || "").toLowerCase().includes(q);
    }).slice(0, 60);
  }, [parts, pkw, pgroup]);

  // ---- รายการที่เลือกใส่รถ ----
  const [items, setItems] = useState([]); // { part_id, part_code, part_name, qty, unit_cost, unit_price(string) }
  const [totalOverride, setTotalOverride] = useState(""); // แก้ยอดรวมที่บวกเข้าราคาขาย (ว่าง = รวมรายชิ้น)
  const [note, setNote] = useState("");
  function addPart(p) {
    if (!veh) { setMessage("❌ เลือกรถก่อน"); return; }
    setItems((s) => {
      const i = s.findIndex((x) => x.part_id === p.id);
      if (i >= 0) return s.map((x, k) => (k === i ? { ...x, qty: num(x.qty) + 1 } : x));
      const cost = num(p.unit_price);
      return [...s, { part_id: p.id, part_code: p.part_code, part_name: p.product_name || p.custom_name || p.part_code, qty: 1, unit_cost: cost, unit_price: String(cost), stock: num(p.quantity), stores: p.stores || "" }];
    });
  }
  const upd = (i, k, v) => setItems((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const del = (i) => setItems((s) => s.filter((_, j) => j !== i));
  const sumCost = items.reduce((t, x) => t + (num(x.qty) || 1) * num(x.unit_cost), 0);
  const sumPrice = items.reduce((t, x) => t + (num(x.qty) || 1) * num(x.unit_price), 0);
  const totalPrice = num(totalOverride) > 0 ? num(totalOverride) : sumPrice;

  async function load() {
    setLoading(true);
    try { setRows(unwrapList(await post(API, { action: "list_dressups" })).filter((r) => r && r.id)); }
    catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function save() {
    if (saving || !veh) return;
    if (!items.length) { setMessage("❌ เลือกอะไหล่แต่งอย่างน้อย 1 รายการ"); return; }
    if (!(totalPrice > 0)) { setMessage("❌ ยอดที่บวกเข้าราคาขายต้องมากกว่า 0"); return; }
    if (!window.confirm(`บันทึกอะไหล่แต่งรถ\n${veh.brand} ${veh.model_name || veh.model_code} · ${veh.engine_no}\n${items.length} รายการ · ทุนรวม ${baht(sumCost)} · บวกเข้าราคาขาย ${baht(totalPrice)} บาท\nหน้าบันทึกขาย NEW จะบวกยอดนี้เข้าราคาขายและโชว์เป็นรถแต่ง ?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post(API, {
        action: "save_dressup",
        engine_no: veh.engine_no, chassis_no: veh.chassis_no || "", brand: veh.brand || "",
        model_label: [veh.model_name || veh.model_code, veh.model_type].filter(Boolean).join(" "), color_name: veh.color_name || "",
        items: items.map((x) => ({ part_id: x.part_id, part_code: x.part_code, part_name: x.part_name, qty: num(x.qty) || 1, unit_cost: num(x.unit_cost), unit_price: num(x.unit_price) })),
        total_price: totalPrice, note: note.trim(), branch_code: myBranch, created_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.id) throw new Error(r?.__error || "บันทึกไม่สำเร็จ (ตรวจว่า import workflow vehicle-dressup-api และรัน DDL แล้ว)");
      setMessage(`✅ บันทึกอะไหล่แต่ง ${veh.engine_no} · ${items.length} รายการ · บวกราคาขาย ${baht(totalPrice)} บาท แล้ว`);
      setVeh(null); setKw(""); setItems([]); setTotalOverride(""); setNote("");
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }
  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกรายการแต่งรถ ${r.engine_no} (${baht(r.total_price)} บาท)?`)) return;
    try {
      const d = await post(API, { action: "cancel_dressup", id: r.id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      if (!d || !d.id) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ (อาจถูกใช้ขายไปแล้ว)");
      setMessage(`✅ ยกเลิกรายการแต่งรถ ${r.engine_no} แล้ว`); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  const visRows = useMemo(() => rows.filter((r) => isAdmin || String(r.branch_code || "").toUpperCase() === myBranch), [rows, isAdmin, myBranch]);

  // ---- พิมพ์ (user 2026-09-24): ใบรายการอะไหล่แต่งรถรายคัน / สรุปรถแต่งทั้งรายการ ----
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const PRINT_CSS = `*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:14px;color:#111;font-size:13px}
h2{margin:0 0 2px;font-size:18px}.sub{color:#555;font-size:12px;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:6px}
th,td{border:1px solid #999;padding:4px 6px;font-size:12px;vertical-align:top}th{background:#eef2f7}.r{text-align:right}.c{text-align:center}.b{font-weight:700}
.box{border:1px solid #999;border-radius:6px;padding:8px 10px;margin-top:6px;font-size:12.5px}.foot{display:flex;justify-content:space-between;margin-top:40px;padding:0 20px}
.sg{text-align:center;width:40%;border-top:1px dotted #777;padding-top:4px;color:#555}.badge{display:inline-block;border:1px solid #999;border-radius:10px;padding:0 8px;font-size:11px}@media print{body{padding:0}}`;
  const openPrint = (title, body) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("❌ เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — อนุญาต pop-up ก่อน"); return; }
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${body}<script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };
  function printDressup(r) {
    const its = Array.isArray(r.items) ? r.items : [];
    const sumCostR = its.reduce((t, it) => t + num(it.qty) * num(it.unit_cost), 0);
    const sumSellR = its.reduce((t, it) => t + num(it.line_total), 0);
    const rowsHtml = its.map((it, i) => `<tr><td class="c">${i + 1}</td><td style="font-family:monospace">${esc(it.part_code)}</td><td>${esc(it.part_name)}</td><td class="c">${num(it.qty)}</td><td class="r">${baht(it.unit_cost)}</td><td class="r">${baht(it.unit_price)}</td><td class="r b">${baht(it.line_total)}</td></tr>`).join("");
    const body = `<h2>🔧 ใบรายการอะไหล่แต่งรถสำหรับขาย #${r.id}</h2>
<div class="sub">สาขา ${esc(r.branch_code || "-")} · บันทึก ${esc(thaiDate(r.created_at))} โดย ${esc(r.created_by || "-")} · สถานะ <span class="badge">${esc(STATUS_TH[r.status] || r.status)}</span>${r.used_sale_no ? ` · ใบขาย ${esc(r.used_sale_no)}` : ""}</div>
<div class="box"><b>${esc(r.brand || "")} ${esc(r.model_label || "")}</b>${r.color_name ? ` · สี${esc(r.color_name)}` : ""}<br>เลขเครื่อง <span style="font-family:monospace">${esc(r.engine_no)}</span> · เลขถัง <span style="font-family:monospace">${esc(r.chassis_no || "-")}</span>${r.note ? `<br>หมายเหตุ: ${esc(r.note)}` : ""}</div>
<table><thead><tr><th style="width:30px">#</th><th style="width:130px">รหัสอะไหล่</th><th>รายการ</th><th style="width:50px">จำนวน</th><th style="width:90px">ทุน/หน่วย</th><th style="width:90px">ราคาขาย/หน่วย</th><th style="width:100px">รวมขาย</th></tr></thead>
<tbody>${rowsHtml || `<tr><td colspan="7" class="c">- ไม่มีรายการ -</td></tr>`}</tbody>
<tfoot><tr><td colspan="4" class="r b">รวม ${its.length} รายการ</td><td class="r">${baht(sumCostR)}</td><td></td><td class="r b">${baht(sumSellR)}</td></tr>
<tr><td colspan="6" class="r b">ยอดที่บวกเข้าราคาขายรถ</td><td class="r b" style="font-size:14px">${baht(r.total_price)}</td></tr>
<tr><td colspan="6" class="r">ทุนรวม ${baht(r.total_cost)} · กำไรจากอะไหล่แต่ง</td><td class="r">${baht(num(r.total_price) - num(r.total_cost))}</td></tr></tfoot></table>
<div class="foot"><div class="sg">ผู้เบิก/ติดตั้ง</div><div class="sg">ผู้ตรวจสอบ</div></div>`;
    openPrint(`อะไหล่แต่งรถ ${r.engine_no}`, body);
  }
  function printList() {
    const list = visRows.filter((r) => r.status === "active");
    if (!list.length) { setMessage("❌ ไม่มีรถแต่งสถานะรอใช้ขายให้พิมพ์"); return; }
    const rowsHtml = list.map((r, i) => {
      const its = Array.isArray(r.items) ? r.items : [];
      return `<tr><td class="c">${i + 1}</td><td>${esc(thaiDate(r.created_at))}</td><td>${esc(r.branch_code || "-")}</td><td>${esc(r.brand || "")} ${esc(r.model_label || "")}${r.color_name ? ` · ${esc(r.color_name)}` : ""}</td><td style="font-family:monospace">${esc(r.engine_no)}</td>
<td style="font-size:11px">${its.map((it) => `${esc(it.part_code)} ${esc(it.part_name)}${num(it.qty) > 1 ? ` ×${num(it.qty)}` : ""}`).join("<br>")}</td><td class="r">${baht(r.total_cost)}</td><td class="r b">${baht(r.total_price)}</td><td>${esc(r.note || "")}</td></tr>`;
    }).join("");
    const tc = list.reduce((t, r) => t + num(r.total_cost), 0), tp = list.reduce((t, r) => t + num(r.total_price), 0);
    const body = `<h2>🔧 สรุปรถแต่งสำหรับขาย (รอใช้ขาย ${list.length} คัน)</h2><div class="sub">พิมพ์ ${esc(thaiDate(new Date().toISOString()))}${!isAdmin ? ` · สาขา ${esc(myBranch)}` : ""}</div>
<table><thead><tr><th>#</th><th>วันที่</th><th>สาขา</th><th>รถ</th><th>เลขเครื่อง</th><th>อะไหล่แต่ง</th><th>ทุนรวม</th><th>บวกราคาขาย</th><th>หมายเหตุ</th></tr></thead><tbody>${rowsHtml}</tbody>
<tfoot><tr><td colspan="6" class="r b">รวม</td><td class="r b">${baht(tc)}</td><td class="r b">${baht(tp)}</td><td></td></tr></tfoot></table>`;
    openPrint("สรุปรถแต่งสำหรับขาย", body);
  }
  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
  const lbl = { fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4, color: "#334155" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const numIn = { ...inp, width: 110, textAlign: "right", padding: "5px 8px" };

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1200 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>🔧 บันทึกอะไหล่แต่งรถสำหรับขาย</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
        เลือกรถในสต๊อก → เลือกอะไหล่จากสต๊อกอะไหล่หมุนเร็ว (ทุน = ราคา/หน่วยจากไฟล์สินค้าคงเหลือ) → แก้ราคาขายรายชิ้นหรือยอดรวมได้ ·
        หน้าบันทึกขาย NEW จะ<b>บวกยอดรวมเข้าราคาขาย</b> ขึ้นป้าย <b>🔧 รถแต่ง</b> และโชว์รายการอะไหล่เป็นของแถมในใบขาย
      </div>

      {/* ขั้น 1: รถ */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label style={lbl}>1) รถที่จะแต่ง — ค้นจากสต๊อก (เลขเครื่อง / เลขถัง)</label>
            <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchVehicle()}
              placeholder="เช่น E3X4E-012345" style={{ ...inp, width: "100%", fontFamily: "monospace" }} />
          </div>
          <button onClick={searchVehicle} disabled={searching}
            style={{ padding: "9px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>
            {searching ? "⏳..." : "🔍 ค้นหา"}
          </button>
        </div>
        {veh && (
          <div style={{ marginTop: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13.5 }}>
            <b>{veh.brand}</b> {veh.model_name || veh.model_code}{veh.model_type ? ` · ${veh.model_type}` : ""}{veh.color_name ? ` · สี${veh.color_name}` : ""}<br />
            เลขเครื่อง <span style={{ fontFamily: "monospace" }}>{veh.engine_no}</span> · เลขถัง <span style={{ fontFamily: "monospace" }}>{veh.chassis_no || "-"}</span>
            {veh.received_date ? ` · รับเข้า ${thaiDate(veh.received_date)}` : ""}
          </div>
        )}
      </div>

      {/* ขั้น 2: เลือกอะไหล่ + รายการที่ใส่ */}
      {veh && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.4fr)", gap: 14, marginBottom: 14 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
            <label style={lbl}>2) อะไหล่แต่ง (กลุ่ม ACCESSORIES + หมวกกันน๊อก) — คลิกเพื่อใส่รถ {partsLoading ? "(กำลังโหลด...)" : `(${parts.length} รหัส)`}</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input value={pkw} onChange={(e) => setPkw(e.target.value)} placeholder="ค้นหา รหัส / ชื่ออะไหล่" style={{ ...inp, flex: 1 }} />
              <select value={pgroup} onChange={(e) => setPgroup(e.target.value)} style={{ ...inp, maxWidth: 200 }}>
                <option value="all">ทุกกลุ่ม</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              {partHits.map((p) => {
                const inCart = items.some((x) => x.part_id === p.id);
                const q = num(p.quantity);
                return (
                  <div key={p.id} onClick={() => addPart(p)} title="คลิกเพื่อใส่รถ"
                    style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 10px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: inCart ? "#f0fdf4" : "#fff" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700 }}>{p.part_code} <span style={{ fontFamily: "Tahoma", fontWeight: 400, color: "#94a3b8", fontSize: 11 }}>{p.product_group}</span></div>
                      <div style={{ fontSize: 12.5, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product_name || p.custom_name || "-"}</div>
                      <div style={{ fontSize: 11, color: q > 0 ? "#15803d" : "#b91c1c" }}>คงเหลือ {q} {p.unit || ""}{p.stores ? ` · ${p.stores}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#072d6b" }}>{num(p.unit_price) > 0 ? baht(p.unit_price) : "-"}</div>
                      <div style={{ fontSize: 10.5, color: "#94a3b8" }}>ทุน/หน่วย</div>
                    </div>
                    <span style={{ fontSize: 18, color: inCart ? "#16a34a" : "#94a3b8" }}>{inCart ? "✓" : "+"}</span>
                  </div>
                );
              })}
              {partHits.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>{partsLoading ? "กำลังโหลด..." : "ไม่พบอะไหล่"}</div>}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
            <label style={lbl}>3) อะไหล่แต่งของคันนี้ ({items.length} รายการ) — แก้จำนวน/ราคาขายรายชิ้นได้</label>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>รหัส / ชื่อ</th><th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                  <th style={{ ...th, textAlign: "right" }}>ทุน/หน่วย</th><th style={{ ...th, textAlign: "right" }}>ราคาขาย/หน่วย</th>
                  <th style={{ ...th, textAlign: "right" }}>รวมขาย</th><th style={th}></th>
                </tr></thead>
                <tbody>
                  {items.map((x, i) => (
                    <tr key={x.part_id + "-" + i}>
                      <td style={td}>
                        <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12.5 }}>{x.part_code}</div>
                        <div style={{ fontSize: 12.5, color: "#334155" }}>{x.part_name}</div>
                        {x.stock != null && num(x.qty) > num(x.stock) && <div style={{ fontSize: 11, color: "#b91c1c" }}>⚠️ เกินสต๊อก (มี {x.stock})</div>}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}><input type="number" min="1" value={x.qty} onChange={(e) => upd(i, "qty", e.target.value)} style={{ ...numIn, width: 64 }} /></td>
                      <td style={{ ...td, textAlign: "right", color: "#64748b" }}>{baht(x.unit_cost)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <input type="number" min="0" value={x.unit_price} onChange={(e) => upd(i, "unit_price", e.target.value)}
                          style={{ ...numIn, fontWeight: 700, color: num(x.unit_price) < num(x.unit_cost) ? "#dc2626" : "#072d6b" }} />
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{baht((num(x.qty) || 1) * num(x.unit_price))}</td>
                      <td style={{ ...td, textAlign: "center" }}><button onClick={() => del(i)} style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer", fontSize: 16 }}>×</button></td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 20 }}>— คลิกอะไหล่ทางซ้ายเพื่อใส่รถ —</td></tr>}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={td} colSpan={2}>รวม</td>
                      <td style={{ ...td, textAlign: "right", color: "#64748b" }}>{baht(sumCost)}</td>
                      <td style={{ ...td, textAlign: "right", fontSize: 11, color: "#64748b", fontWeight: 400 }}>รวมรายชิ้น</td>
                      <td style={{ ...td, textAlign: "right" }}>{baht(sumPrice)}</td><td style={td}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
              <div style={{ flex: "0 1 230px" }}>
                <label style={lbl}>ยอดรวมที่บวกเข้าราคาขายรถ (แก้ได้)</label>
                <input type="number" min="0" value={totalOverride} onChange={(e) => setTotalOverride(e.target.value)} placeholder={baht(sumPrice)}
                  style={{ ...inp, width: "100%", textAlign: "right", fontWeight: 700, fontSize: 18, color: "#166534" }} />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>ว่าง = ใช้ยอดรวมรายชิ้น {baht(sumPrice)} · ทุนรวม {baht(sumCost)} · กำไร {baht(totalPrice - sumCost)}</div>
              </div>
              <div style={{ flex: "1 1 260px" }}>
                <label style={lbl}>หมายเหตุ</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ชุดแต่งโชว์หน้าร้าน / ตามที่ลูกค้าจองสั่งแต่ง" style={{ ...inp, width: "100%" }} />
              </div>
              <button onClick={save} disabled={saving || !items.length}
                style={{ padding: "10px 24px", background: saving || !items.length ? "#cbd5e1" : "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "wait" : "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>
                {saving ? "⏳ กำลังบันทึก..." : `💾 บันทึกรถแต่ง (+${baht(totalPrice)})`}
              </button>
            </div>
          </div>
        </div>
      )}
      {message && <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: message.startsWith("✅") ? "#15803d" : message.startsWith("ℹ️") ? "#1d4ed8" : "#b91c1c" }}>{message}</div>}

      {/* รายการที่บันทึกไว้ */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>📋 รถแต่งที่บันทึกไว้ ({visRows.length})</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={printList} disabled={loading} title="พิมพ์สรุปรถแต่งที่รอใช้ขายทั้งหมด" style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #072d6b", background: "#072d6b", color: "#fff", cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>🖨 พิมพ์รายการ</button>
            <button onClick={load} disabled={loading} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{loading ? "⏳" : "🔄"}</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>วันที่</th><th style={th}>สาขา</th><th style={th}>รถ</th><th style={th}>เลขเครื่อง</th>
              <th style={{ ...th, textAlign: "right" }}>รายการ</th><th style={{ ...th, textAlign: "right" }}>ทุนรวม</th><th style={{ ...th, textAlign: "right" }}>บวกราคาขาย</th>
              <th style={th}>หมายเหตุ</th><th style={th}>สถานะ</th><th style={th}>ผู้บันทึก</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {visRows.map((r, i) => {
                const its = Array.isArray(r.items) ? r.items : [];
                const open = openId === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr style={{ background: r.status === "active" ? (i % 2 ? "#fafcff" : "#fff") : "#f8fafc", opacity: ["cancelled", "replaced"].includes(r.status) ? 0.55 : 1 }}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.created_at)}</td>
                      <td style={td}>{r.branch_code || "-"}</td>
                      <td style={td}>{r.brand} {r.model_label || "-"}{r.color_name ? ` · ${r.color_name}` : ""}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button onClick={() => setOpenId(open ? null : r.id)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>{its.length} รายการ {open ? "▲" : "▼"}</button>
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "#64748b" }}>{baht(r.total_cost)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#166534" }}>+{baht(r.total_price)}</td>
                      <td style={{ ...td, fontSize: 12.5, maxWidth: 220 }}>{r.note || "-"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {STATUS_TH[r.status] || r.status}
                        {r.status === "used" && r.used_sale_no ? <div style={{ fontSize: 10.5, color: "#15803d", fontFamily: "monospace" }}>{r.used_sale_no}</div> : null}
                      </td>
                      <td style={td}>{r.created_by || "-"}</td>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                        <button onClick={() => printDressup(r)} title="พิมพ์ใบรายการอะไหล่แต่งรถคันนี้"
                          style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #072d6b", background: "#fff", color: "#072d6b", cursor: "pointer", fontSize: 12, marginRight: 4 }}>🖨 พิมพ์</button>
                        {r.status === "active" && (
                          <button onClick={() => cancelRow(r)} title="ยกเลิกรายการแต่ง"
                            style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #ef4444", background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}>✖ ยกเลิก</button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr><td colSpan={11} style={{ ...td, background: "#f8fafc", padding: "6px 12px 10px" }}>
                        <table style={{ borderCollapse: "collapse", fontSize: 12.5 }}>
                          <tbody>
                            {its.map((it) => (
                              <tr key={it.id}>
                                <td style={{ padding: "2px 10px 2px 0", fontFamily: "monospace" }}>{it.part_code}</td>
                                <td style={{ padding: "2px 10px 2px 0" }}>{it.part_name}</td>
                                <td style={{ padding: "2px 10px 2px 0", textAlign: "right" }}>× {num(it.qty)}</td>
                                <td style={{ padding: "2px 10px 2px 0", textAlign: "right", color: "#64748b" }}>ทุน {baht(it.unit_cost)}</td>
                                <td style={{ padding: "2px 0", textAlign: "right", fontWeight: 700 }}>ขาย {baht(it.unit_price)} = {baht(it.line_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
              {visRows.length === 0 && !loading && (
                <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ยังไม่มีรายการรถแต่ง —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
