import React, { useEffect, useState, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-api";
const HR_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function postHrAPI(body) {
  const r = await fetch(HR_API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

const NOW = new Date();

export default function YamahaRepairReportPage() {
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null);
  const [itemTypeDetail, setItemTypeDetail] = useState(null); // { item_type, rows }
  const [employees, setEmployees] = useState([]);
  const [checkFees, setCheckFees] = useState([]); // [{id, year, month, mechanic_name, amount, note}]
  const [checkFeeModal, setCheckFeeModal] = useState(null); // { mechanic_name }
  const [checkFeeForm, setCheckFeeForm] = useState({ amount: "", note: "" });
  const [checkFeeSaving, setCheckFeeSaving] = useState(false);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({
        action: "list_yamaha_repair_invoices",
        year: year || "", month: month || "",
        branch_code: branch, status, search,
      });
      const arr = Array.isArray(data) ? data.filter(r => r && r.id) : [];
      setRows(arr);
    } catch { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  async function fetchEmployees() {
    try {
      const data = await postHrAPI({ action: "list_hr_employees", include_inactive: "true" });
      setEmployees(Array.isArray(data) ? data : []);
    } catch { setEmployees([]); }
  }
  async function fetchCheckFees() {
    try {
      const data = await postAPI({ action: "list_yamaha_check_fee", year: year || "", month: month || "" });
      setCheckFees(Array.isArray(data) ? data : []);
    } catch { setCheckFees([]); }
  }
  async function saveCheckFee() {
    if (!checkFeeModal?.mechanic_name) return;
    const amt = Number(checkFeeForm.amount);
    if (!amt || amt <= 0) { setMessage("❌ กรุณาใส่จำนวนเงิน"); return; }
    setCheckFeeSaving(true);
    try {
      await postAPI({
        action: "save_yamaha_check_fee",
        year: year || NOW.getFullYear(), month: month || (NOW.getMonth() + 1),
        mechanic_name: checkFeeModal.mechanic_name,
        amount: amt, note: checkFeeForm.note || "",
        created_by: "system",
      });
      setCheckFeeForm({ amount: "", note: "" });
      await fetchCheckFees();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setCheckFeeSaving(false);
  }
  async function deleteCheckFee(id) {
    if (!confirm("ลบรายการนี้?")) return;
    try {
      await postAPI({ action: "delete_yamaha_check_fee", id });
      await fetchCheckFees();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }
  useEffect(() => { fetchData(); fetchEmployees(); fetchCheckFees(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchCheckFees(); /* eslint-disable-next-line */ }, [year, month]);

  // map ชื่อพนักงาน → ตำแหน่ง (สำหรับเช็คว่าใครไม่ใช่ช่าง)
  const positionByName = useMemo(() => {
    const m = new Map();
    for (const e of employees) {
      if (e.employee_name) m.set(String(e.employee_name).trim(), String(e.position || "").trim());
    }
    return m;
  }, [employees]);
  const isMechanic = (name) => {
    const pos = positionByName.get(String(name || "").trim()) || "";
    return pos.includes("ช่าง");
  };
  const TRANSFER_TO = "ชัยณรงค์ เกิดทรัพย์"; // ผู้รับยอด labor+coupon ของคนที่ไม่ใช่ช่าง

  // group by job_no for summary
  const byJob = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = r.job_no;
      if (!map.has(k)) map.set(k, { ...r, lines: [], total_revenue: 0, total_outstanding: 0, total_labor: 0 });
      const g = map.get(k);
      g.lines.push(r);
      g.total_revenue += Number(r.net_revenue || 0);
      g.total_outstanding += Number(r.outstanding || 0);
      g.total_labor += Number(r.labor_total || 0);
    }
    return [...map.values()];
  }, [rows]);

  const totalRevenue = byJob.reduce((s, j) => s + j.total_revenue, 0);
  const branches = [...new Set(rows.map(r => r.branch_code).filter(Boolean))];
  const statuses = [...new Set(rows.map(r => r.status).filter(Boolean))];

  // Pivot: rows=ช่างซ่อม, columns=item_type (เป็นยอดเงิน)
  // รายการค่าแรง → labor_total | ใบแจ้งซ่อม → net_revenue | คูปอง → count×40 | parts_value → นับครั้งเดียวต่อ job_no
  const mechanicPivot = useMemo(() => {
    const map = new Map();
    const partsCountedJobs = new Set();  // กัน parts_value ถูกบวกซ้ำหลายบรรทัดของ job เดียวกัน
    for (const r of rows) {
      const name = r.mechanic_name || "(ไม่ระบุ)";
      if (!map.has(name)) map.set(name, {
        mechanic_name: name,
        labor_amount: 0, invoice_amount: 0, coupon_count: 0, parts_value: 0,
      });
      const g = map.get(name);
      const it = r.item_type || "";
      if (it === "รายการค่าแรง") g.labor_amount += Number(r.labor_total || 0);
      else if (it === "ใบแจ้งซ่อม") g.invoice_amount += Number(r.net_revenue || 0);
      else if (it === "คูปอง") g.coupon_count += 1;
      // parts_value ต่อ job — นับครั้งเดียว
      const jobKey = `${name}|${r.job_no}`;
      if (!partsCountedJobs.has(jobKey)) {
        partsCountedJobs.add(jobKey);
        g.parts_value += Number(r.parts_value || 0);
      }
    }
    // sum ค่าเช็ครถ ต่อช่าง (จาก checkFees ของปี/เดือนนี้)
    const checkFeeByMechanic = new Map();
    for (const f of checkFees) {
      const n = String(f.mechanic_name || "").trim();
      checkFeeByMechanic.set(n, (checkFeeByMechanic.get(n) || 0) + Number(f.amount || 0));
    }

    const list = [...map.values()].map(g => ({
      ...g,
      coupon_amount: g.coupon_count * 40,
      check_fee_amount: checkFeeByMechanic.get(String(g.mechanic_name).trim()) || 0,
      total: g.labor_amount + g.invoice_amount + g.coupon_count * 40,
    }));

    // ย้ายทุกยอดของคนที่ตำแหน่งไม่ใช่ "ช่าง" (labor + coupon + ใบแจ้งซ่อม + มูลค่าสินค้า) ไปรวมที่ TRANSFER_TO
    // แล้วลบแถวเดิมออก
    let finalList = list;
    if (positionByName.size > 0) {
      let transferTo = list.find(g => g.mechanic_name === TRANSFER_TO);
      if (!transferTo) {
        transferTo = { mechanic_name: TRANSFER_TO, labor_amount: 0, invoice_amount: 0, coupon_count: 0, coupon_amount: 0, parts_value: 0, check_fee_amount: checkFeeByMechanic.get(TRANSFER_TO) || 0, total: 0 };
        list.push(transferTo);
      }
      for (const g of list) {
        if (g === transferTo) continue;
        if (!isMechanic(g.mechanic_name)) {
          transferTo.labor_amount += g.labor_amount;
          transferTo.coupon_count += g.coupon_count;
          transferTo.coupon_amount += g.coupon_amount;
          transferTo.invoice_amount += g.invoice_amount;
          transferTo.parts_value += g.parts_value;
        }
      }
      // ลบแถวของคนไม่ใช่ช่างออก
      finalList = list.filter(g => g === transferTo || isMechanic(g.mechanic_name));
    }
    // recompute total per row (รวม + check_fee)
    for (const g of finalList) {
      g.total = g.labor_amount + g.invoice_amount + g.coupon_amount + g.check_fee_amount;
    }
    return finalList.sort((a, b) => b.total - a.total);
  }, [rows, positionByName, checkFees]);

  // total parts value (unique per job_no)
  const totalPartsValue = useMemo(() => {
    const seen = new Set();
    let sum = 0;
    for (const r of rows) {
      if (seen.has(r.job_no)) continue;
      seen.add(r.job_no);
      sum += Number(r.parts_value || 0);
    }
    return sum;
  }, [rows]);

  // สรุปต่อประเภทรายการ (item_type) — ใบแจ้งซ่อม / รายการค่าแรง / คูปอง
  const byItemType = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = r.item_type || "(ไม่ระบุ)";
      if (!map.has(k)) map.set(k, { item_type: k, count: 0, revenue: 0, labor: 0 });
      const g = map.get(k);
      g.count += 1;
      g.revenue += Number(r.net_revenue || 0);
      g.labor += Number(r.labor_total || 0);
    }
    return [...map.values()].map(g => ({
      ...g,
      // คูปอง: ใช้ count × 40
      coupon_value: g.item_type === "คูปอง" ? g.count * 40 : null,
    })).sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔧 รายงานใบแจ้งซ่อม Yamaha</h2>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ปี:</span>
        <input type="number" value={year} onChange={e => setYear(e.target.value)} style={{ ...inp, width: 90 }} />
        <span>เดือน:</span>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: 100 }}>
          <option value="">ทั้งปี</option>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" placeholder="รหัสสาขา" value={branch} onChange={e => setBranch(e.target.value.toUpperCase())} style={{ ...inp, width: 130, fontFamily: "monospace" }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, minWidth: 200 }}>
          <option value="">-- ทุกสถานะ --</option>
          <option value="ปิดใบงาน (มีค่าใช้จ่าย)">ปิดใบงาน (มีค่าใช้จ่าย)</option>
          <option value="ปิดใบงาน (ไม่มีค่าใช้จ่าย)">ปิดใบงาน (ไม่มีค่าใช้จ่าย)</option>
          <option value="เปิดใบงาน">เปิดใบงาน</option>
          <option value="ยกเลิกใบงาน">ยกเลิกใบงาน</option>
        </select>
        <input type="text" placeholder="🔍 ค้นหา (ใบแจ้ง/ลูกค้า/เลขถัง/ทะเบียน/ช่าง)" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 280 }} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 ค้นหา"}</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="📋 ใบแจ้งซ่อม" value={byJob.length} color="#1e40af" />
        <Card label="📌 รายการ (lines)" value={rows.length} color="#0369a1" />
        <Card label="💰 รายได้สุทธิรวม" value={fmt(totalRevenue)} color="#059669" highlight />
        <Card label="📦 มูลค่าสินค้า (จาก yamaha_part_dispense)" value={fmt(totalPartsValue)} color="#0891b2" />
      </div>

      {/* Pivot: ช่างซ่อม × ประเภทรายการ (ยอดเงิน) */}
      {mechanicPivot.length > 0 && (
        <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 6 }}>🛠️ สรุปยอดเงินของช่างซ่อม แยกตามประเภทรายการ</div>
          <div style={{ overflowX: "auto", maxHeight: 500 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f0f4f9", position: "sticky", top: 0 }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ช่างซ่อม</th>
                  <th style={{ ...th, textAlign: "right" }}>รายการค่าแรง</th>
                  <th style={{ ...th, textAlign: "right" }}>คูปอง (×40)</th>
                  <th style={{ ...th, textAlign: "right", background: "#fce7f3", color: "#9d174d" }}>ค่าเช็ครถ</th>
                  <th style={{ ...th, textAlign: "right", background: "#fef9c3", color: "#072d6b" }}>รวมค่าแรง</th>
                  <th style={{ ...th, textAlign: "right", background: "#dcfce7", color: "#15803d" }}>ค่าคอมมิชชั่น (65%)</th>
                  <th style={{ ...th, textAlign: "right" }}>ใบแจ้งซ่อม</th>
                  <th style={{ ...th, textAlign: "right", background: "#fef9c3", color: "#072d6b" }}>รวม</th>
                  <th style={{ ...th, textAlign: "right", background: "#cffafe", color: "#0891b2" }}>มูลค่าสินค้า</th>
                </tr>
              </thead>
              <tbody>
                {mechanicPivot.map((g, i) => {
                  const laborTotal = (g.labor_amount || 0) + (g.coupon_amount || 0) + (g.check_fee_amount || 0);
                  return (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {g.mechanic_name}
                      <button onClick={() => { setCheckFeeModal({ mechanic_name: g.mechanic_name }); setCheckFeeForm({ amount: "", note: "" }); }}
                              style={{ marginLeft: 8, padding: "2px 8px", fontSize: 11, background: "#9d174d", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        + เพิ่มรายการ
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.labor_amount ? fmt(g.labor_amount) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#f59e0b", fontWeight: 600 }}>
                      {g.coupon_amount ? fmt(g.coupon_amount) : "-"}
                      {g.coupon_count > 0 && <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 400, marginLeft: 4 }}>({g.coupon_count})</span>}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#9d174d", fontWeight: 600, background: "#fdf2f8" }}>
                      {g.check_fee_amount ? fmt(g.check_fee_amount) : "-"}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#fef9c3" }}>{laborTotal ? fmt(laborTotal) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>{laborTotal ? fmt(laborTotal * 0.65) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{g.invoice_amount ? fmt(g.invoice_amount) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#fef9c3" }}>{fmt(g.total)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#cffafe", color: "#0891b2" }}>{g.parts_value ? fmt(g.parts_value) : "-"}</td>
                  </tr>
                )})}
                {(() => {
                  const sumLabor = mechanicPivot.reduce((s,g)=>s+(g.labor_amount||0),0);
                  const sumCoupon = mechanicPivot.reduce((s,g)=>s+(g.coupon_amount||0),0);
                  const sumCheckFee = mechanicPivot.reduce((s,g)=>s+(g.check_fee_amount||0),0);
                  const sumLaborTotal = sumLabor + sumCoupon + sumCheckFee;
                  return (
                  <tr style={{ background: "#fde68a", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                    <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวม</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumLabor)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#f59e0b" }}>{fmt(sumCoupon)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#9d174d" }}>{fmt(sumCheckFee)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumLaborTotal)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#15803d" }}>{fmt(sumLaborTotal * 0.65)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(mechanicPivot.reduce((s,g)=>s+g.invoice_amount,0))}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(mechanicPivot.reduce((s,g)=>s+g.total,0))}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0891b2" }}>{fmt(mechanicPivot.reduce((s,g)=>s+(g.parts_value||0),0))}</td>
                  </tr>
                )})()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* สรุปต่อประเภทรายการ */}
      {byItemType.length > 0 && (
        <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 6 }}>📊 สรุปประเภทรายการ</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ประเภทรายการ</th>
                  <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าแรงรวม</th>
                  <th style={{ ...th, textAlign: "right" }}>รายได้สุทธิ</th>
                  <th style={{ ...th, textAlign: "right" }}>คูปอง (×40)</th>
                </tr>
              </thead>
              <tbody>
                {byItemType.map((g, i) => {
                  const filteredRows = rows.filter(r => (r.item_type || "(ไม่ระบุ)") === g.item_type);
                  const openDetail = () => setItemTypeDetail({ item_type: g.item_type, rows: filteredRows, coupon_value: g.coupon_value });
                  return (
                    <tr key={g.item_type} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <span style={{ cursor: "pointer", color: "#0369a1", textDecoration: "underline" }} onClick={openDetail}>{g.item_type}</span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", cursor: "pointer", color: "#0369a1", textDecoration: "underline" }} onClick={openDetail}>{g.count}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", cursor: "pointer", color: "#0369a1", textDecoration: "underline" }} onClick={openDetail}>{fmt(g.labor)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669", cursor: "pointer", textDecoration: "underline" }} onClick={openDetail}>{fmt(g.revenue)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#f59e0b", fontWeight: 700, cursor: g.coupon_value !== null ? "pointer" : "default", textDecoration: g.coupon_value !== null ? "underline" : "none" }} onClick={g.coupon_value !== null ? openDetail : undefined}>
                        {g.coupon_value !== null ? fmt(g.coupon_value) : "-"}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                  <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวม</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{byItemType.reduce((s,g)=>s+g.count,0)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(byItemType.reduce((s,g)=>s+g.labor,0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(byItemType.reduce((s,g)=>s+g.revenue,0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#f59e0b" }}>{fmt(byItemType.reduce((s,g)=>s+(g.coupon_value||0),0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Item type detail popup */}
      {itemTypeDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setItemTypeDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1400, width: "95%", maxHeight: "90vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 รายละเอียด — {itemTypeDetail.item_type} ({itemTypeDetail.rows.length} รายการ)
                {itemTypeDetail.coupon_value !== null && <span style={{ marginLeft: 10, color: "#f59e0b" }}>· คูปอง × 40 = {fmt(itemTypeDetail.coupon_value)}</span>}
              </h3>
              <button onClick={() => setItemTypeDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th><th style={th}>สาขา</th><th style={th}>เลขใบแจ้ง</th><th style={th}>วันที่</th>
                  <th style={th}>ลูกค้า</th><th style={th}>ทะเบียน</th><th style={th}>รุ่น</th><th style={th}>ช่าง</th>
                  <th style={th}>รหัสซ่อม</th><th style={th}>ประเภทการซ่อม</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าแรง</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าแรงรวม</th>
                  <th style={{ ...th, textAlign: "right" }}>รายได้สุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {itemTypeDetail.rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.job_no}</td>
                    <td style={td}>{r.repair_day}/{r.repair_month}/{r.repair_year}</td>
                    <td style={td}>{r.customer || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.license_plate || "-"}</td>
                    <td style={td}>{r.series} · {r.model_code}</td>
                    <td style={td}>{r.mechanic_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.repair_type_code || "-"}</td>
                    <td style={td}>{r.repair_type || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.labor_price)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.labor_total)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(r.net_revenue)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                  <td colSpan={10} style={{ ...td, textAlign: "right" }}>รวม</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(itemTypeDetail.rows.reduce((s,r)=>s+Number(r.labor_price||0),0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(itemTypeDetail.rows.reduce((s,r)=>s+Number(r.labor_total||0),0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(itemTypeDetail.rows.reduce((s,r)=>s+Number(r.net_revenue||0),0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail popup */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1400, width: "95%", maxHeight: "90vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 {detail.job_no} · {detail.customer} · {detail.repair_day}/{detail.repair_month}/{detail.repair_year}</h3>
              <button onClick={() => setDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            <div style={{ background: "#f0f4f9", padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <div><strong>สาขา:</strong> {detail.branch_code} · {detail.branch_name}</div>
              <div><strong>ทะเบียน:</strong> {detail.license_plate || "-"}</div>
              <div><strong>เครื่อง:</strong> {detail.engine_no || "-"}</div>
              <div><strong>ถัง:</strong> {detail.chassis_no || "-"}</div>
              <div><strong>รุ่น:</strong> {detail.brand} · {detail.series} · {detail.model_code}</div>
              <div><strong>สี:</strong> {detail.color || "-"}</div>
              <div><strong>ระยะ:</strong> {detail.mileage || "-"}</div>
              <div><strong>โทร:</strong> {detail.customer_phone || "-"}</div>
              <div><strong>ช่าง:</strong> {detail.mechanic_code} · {detail.mechanic_name}</div>
              <div><strong>แท่น:</strong> {detail.bay_no || "-"}</div>
              <div><strong>สถานะ:</strong> {detail.status}</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ประเภทรายการ</th>
                  <th style={th}>รหัสซ่อม</th>
                  <th style={th}>ประเภทการซ่อม</th>
                  <th style={{ ...th, textAlign: "right" }}>FlatRate</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าแรง</th>
                  <th style={{ ...th, textAlign: "right" }}>ส่วนลด</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าแรงรวม</th>
                  <th style={{ ...th, textAlign: "right" }}>รายได้สุทธิ</th>
                  <th style={{ ...th, textAlign: "right" }}>ค้างชำระ</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{r.item_type}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.repair_type_code}</td>
                    <td style={td}>{r.repair_type}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.flat_rate)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.labor_price)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.labor_discount)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.labor_total)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(r.net_revenue)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{fmt(r.outstanding)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                  <td colSpan={7} style={{ ...td, textAlign: "right" }}>รวม</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(detail.total_labor)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(detail.total_revenue)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{fmt(detail.total_outstanding)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check Fee modal */}
      {checkFeeModal && (() => {
        const entries = checkFees.filter(f => String(f.mechanic_name || "").trim() === String(checkFeeModal.mechanic_name).trim());
        const totalAmt = entries.reduce((s, f) => s + Number(f.amount || 0), 0);
        return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setCheckFeeModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 700, width: "95%", maxHeight: "90vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#9d174d" }}>💰 ค่าเช็ครถ — {checkFeeModal.mechanic_name}
                <span style={{ marginLeft: 10, fontSize: 13, color: "#6b7280" }}>({year}/{month})</span>
              </h3>
              <button onClick={() => setCheckFeeModal(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>

            {/* Add form */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 10, background: "#fdf2f8", borderRadius: 8, marginBottom: 12 }}>
              <input type="number" placeholder="จำนวนเงิน" value={checkFeeForm.amount}
                     onChange={e => setCheckFeeForm(f => ({ ...f, amount: e.target.value }))}
                     style={{ ...inp, width: 140 }} />
              <input type="text" placeholder="หมายเหตุ (ถ้ามี)" value={checkFeeForm.note}
                     onChange={e => setCheckFeeForm(f => ({ ...f, note: e.target.value }))}
                     style={{ ...inp, flex: 1 }} />
              <button onClick={saveCheckFee} disabled={checkFeeSaving}
                      style={{ padding: "7px 14px", background: "#9d174d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                {checkFeeSaving ? "..." : "💾 บันทึก"}
              </button>
            </div>

            {/* Entries list */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>วันที่บันทึก</th>
                  <th style={{ ...th, textAlign: "right" }}>จำนวนเงิน</th>
                  <th style={th}>หมายเหตุ</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#6b7280" }}>ยังไม่มีรายการ</td></tr>
                )}
                {entries.map((f, i) => (
                  <tr key={f.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{f.created_at ? String(f.created_at).slice(0, 16).replace("T", " ") : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#9d174d", fontWeight: 600 }}>{fmt(f.amount)}</td>
                    <td style={td}>{f.note || "-"}</td>
                    <td style={td}>
                      <button onClick={() => deleteCheckFee(f.id)}
                              style={{ padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {entries.length > 0 && (
                  <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                    <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวม</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#9d174d" }}>{fmt(totalAmt)}</td>
                    <td colSpan={2} style={td}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnSmBlue = { padding: "4px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };
