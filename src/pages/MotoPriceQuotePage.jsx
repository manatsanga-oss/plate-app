import React, { useEffect, useState } from "react";

const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MotoPriceQuotePage({ currentUser }) {
  const [motoTypes, setMotoTypes] = useState([]);
  const [motoSeries, setMotoSeries] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]);
  const [prices, setPrices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [financeCompanies, setFinanceCompanies] = useState([]);
  const [markups, setMarkups] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterBrand, setFilterBrand] = useState("");
  const [filterMarketing, setFilterMarketing] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterType, setFilterType] = useState("");
  const [saleType, setSaleType] = useState("เงินสด"); // เงินสด | ขายไฟแนนซ์
  // ดึง branch_code จาก currentUser (เช่น "SCY01 สำนักงานใหญ่" → "SCY01")
  const userBranchCode = (() => {
    const b = String(currentUser?.branch || "").trim();
    const m = b.match(/SCY\d{2}/i);
    return m ? m[0].toUpperCase() : "SCY05";
  })();
  const [branch] = useState(userBranchCode);
  const [financeId, setFinanceId] = useState("");

  // Adjustable checkboxes
  const [useDeliveryFee, setUseDeliveryFee] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [useDownPayout, setUseDownPayout] = useState(false);
  const [downPayout, setDownPayout] = useState(0);
  const [useInsurancePayout, setUseInsurancePayout] = useState(false);
  const [insurancePayout, setInsurancePayout] = useState(0);
  const [targetPrice, setTargetPrice] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [tRes, sRes, ptRes, pRes, eRes, fRes, mRes] = await Promise.all([
        fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_types" }) }),
        fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_series" }) }).catch(() => null),
        fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_price_types" }) }),
        fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_moto_prices" }) }).catch(() => null),
        fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_sale_expenses" }) }),
        fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_finance_companies" }) }),
        fetch(ACC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_price_markups" }) }).catch(() => null),
      ]);
      const t = await tRes.json();
      const s = sRes ? await sRes.json() : [];
      const pt = await ptRes.json();
      const p = pRes ? await pRes.json() : [];
      const e = await eRes.json();
      const f = await fRes.json();
      const m = mRes ? await mRes.json() : [];
      console.log("MotoPriceQuote loaded:", { types: (t || []).length, series: (s || []).length, priceTypes: (pt || []).length, prices: (p || []).length, expenses: (e || []).length, finances: (f || []).length, markups: (m || []).length });
      setMarkups((Array.isArray(m) ? m : []).filter(x => x.status === "active"));
      setMotoTypes((Array.isArray(t) ? t : []).filter(m => m.status === "active" && m.model_status === "active" && m.series_status === "active" && m.brand_status === "active"));
      setMotoSeries(Array.isArray(s) ? s : []);
      setPriceTypes(Array.isArray(pt) ? pt.filter(p => p.status === "active") : []);
      setPrices(Array.isArray(p) ? p : []);
      setExpenses(Array.isArray(e) ? e.filter(x => x.status === "active") : []);
      setFinanceCompanies(Array.isArray(f) ? f.filter(x => x.status === "active") : []);
    } catch (err) {
      console.error("fetchAll error:", err);
    }
    setLoading(false);
  }

  // Cascade dropdowns
  const brandOpts = [...new Set(motoTypes.map(m => m.brand_name).filter(Boolean))].sort();
  const marketingOpts = [...new Set(motoTypes.filter(m => !filterBrand || m.brand_name === filterBrand).map(m => m.marketing_name || m.series_name).filter(Boolean))].sort();
  const modelOpts = [...new Set(motoTypes.filter(m => (!filterBrand || m.brand_name === filterBrand) && (!filterMarketing || (m.marketing_name || m.series_name) === filterMarketing)).map(m => m.model_code).filter(Boolean))].sort();
  const typeOpts = [...new Set(motoTypes.filter(m =>
    (!filterBrand || m.brand_name === filterBrand) &&
    (!filterMarketing || (m.marketing_name || m.series_name) === filterMarketing) &&
    (!filterModel || m.model_code === filterModel)
  ).map(m => m.type_name).filter(Boolean))].sort();

  const selectedRow = motoTypes.find(m =>
    m.brand_name === filterBrand &&
    (m.marketing_name || m.series_name) === filterMarketing &&
    m.model_code === filterModel &&
    m.type_name === filterType
  );

  // หาราคาประกาศจาก moto_type_prices
  // branch (state) เก็บเป็น branch_code (SCY01-07) → map เป็นกลุ่ม ป.เปา/สิงห์ชัย เพื่อหา price_type
  const branchName = ["SCY05", "SCY06"].includes(branch) ? "ป.เปา" : "สิงห์ชัย";
  function findPrice() {
    if (!selectedRow) return null;
    const matchingPriceType = priceTypes.find(pt => {
      const name = String(pt.type_name || "").toLowerCase();
      const isFinance = saleType === "ขายไฟแนนซ์";
      const branchMatch = name.includes(branchName.toLowerCase());
      if (isFinance) return (name.includes("ไฟแนนท์") || name.includes("ไฟแนนซ์")) && branchMatch;
      return name.includes("เงินสด") && branchMatch;
    });
    if (!matchingPriceType) return null;
    // price_types ใช้ type_id เป็น PK (ตรงกับ moto_type_prices.price_type_id)
    const ptId = matchingPriceType.price_type_id || matchingPriceType.type_id;
    const p = prices.find(x => String(x.type_id) === String(selectedRow.type_id) && String(x.price_type_id) === String(ptId));
    return p ? Number(p.amount || 0) : null;
  }

  const announcedPrice = findPrice();

  // กรอง expenses ตามเงื่อนไข (brand / cc / finance / category)
  function getRowCC() {
    if (!selectedRow) return null;
    const s = motoSeries.find(s => String(s.series_id) === String(selectedRow.series_id));
    return s ? Number(s.engine_cc) : null;
  }

  const applicableExpenses = expenses.filter(e => {
    if (!selectedRow) return false;
    if (e.group_by === "brand" && String(e.brand_id) === String(selectedRow.brand_id)) return true;
    if (e.group_by === "type" && String(e.type_id) === String(selectedRow.type_id)) return true;
    if (e.group_by === "cc") {
      const rowCC = getRowCC();
      if (rowCC && Number(e.engine_cc) === rowCC) return true;
    }
    if (e.group_by === "finance" && financeId && String(e.company_id) === String(financeId)) return true;
    return false;
  });

  // เลือก markups ที่เข้าเงื่อนไขกับ context ปัจจุบัน
  const applicableMarkups = (() => {
    if (!selectedRow) return [];
    const norm = s => String(s || "").toLowerCase().replace(/[\s\(\)\[\]\.\-_]/g, "").trim();
    const finName = financeCompanies.find(f => String(f.company_id) === String(financeId))?.company_name || "";
    const finN = norm(finName);
    const brand = (selectedRow.brand_name || "").toLowerCase();
    const modelCode = (selectedRow.model_code || "").toLowerCase();
    const rowCC = getRowCC();
    // branch ใน state เก็บเป็น branch_code (SCY01, SCY04, SCY05, SCY06, SCY07)
    const branchCode = branch;
    const branchGroup = ["SCY05", "SCY06"].includes(branch) ? "papao" : "singchai";
    const finMatch = (m) => {
      if (!finN || !m.finance_company) return false;
      const mN = norm(m.finance_company);
      return mN === finN || mN.includes(finN) || finN.includes(mN);
    };
    return markups.filter(m => {
      if (m.markup_type === "finance") {
        if (saleType !== "ขายไฟแนนซ์") return false;
        return finMatch(m);
      }
      if (m.markup_type === "finance_cc") {
        if (saleType !== "ขายไฟแนนซ์") return false;
        if (!finMatch(m)) return false;
        // branch_group อาจเก็บเป็น branch_code (SCY05) หรือ group (papao/singchai/all)
        if (m.branch_group && m.branch_group !== "all"
            && m.branch_group !== branchCode
            && m.branch_group !== branchGroup) return false;
        if (rowCC !== null) {
          if (m.cc_min && rowCC < Number(m.cc_min)) return false;
          if (m.cc_max && rowCC > Number(m.cc_max)) return false;
        }
        return true;
      }
      if (m.markup_type === "custom") {
        if (m.brand && m.brand.toLowerCase() !== brand) return false;
        if (m.model_code && m.model_code.toLowerCase() !== modelCode) return false;
        if (m.branch_group && m.branch_group !== "all"
            && m.branch_group !== branchCode
            && m.branch_group !== branchGroup) return false;
        return true;
      }
      // installment_bonus, cosmos_insurance, other_income — ใช้กับ sale_invoice_no ไม่เกี่ยวกับ quote
      return false;
    });
  })();

  // บวกเพิ่มค่านำพา (HONDA: 500→2000, YAMAHA: 500→1000)
  function deliveryFeeBonusAmount() {
    if (!useDeliveryFee || !selectedRow) return 0;
    const fee = Number(deliveryFee || 0);
    if (fee <= 0) return 0;
    const b = (selectedRow.brand_name || "").toLowerCase();
    const multiplier = b.includes("honda") || b.includes("ฮอนด้า") ? 2000 : b.includes("yamaha") || b.includes("ยามาฮ่า") ? 1000 : 0;
    return Math.floor(fee / 500) * multiplier;
  }
  const deliveryBonus = deliveryFeeBonusAmount();
  const markupsTotal = applicableMarkups.reduce((s, m) => s + Number(m.markup_amount || 0), 0);

  // เงินดาวน์ออกแทน: input × 107/100 ปัดขึ้นหลักร้อย → บวกเข้าราคา
  const downPayoutCalc = useDownPayout
    ? Math.ceil((Number(downPayout || 0) * 1.07) / 100) * 100
    : 0;
  // ประกันออกแทน: ใช้ยอดตามที่ใส่ตรงๆ (ไม่มีสูตร)
  const insurancePayoutCalc = useInsurancePayout
    ? Number(insurancePayout || 0)
    : 0;

  // คำนวณยอด
  const totalPrice = (announcedPrice || 0)
    + markupsTotal
    + deliveryBonus
    + (useDeliveryFee ? Number(deliveryFee || 0) : 0)
    + downPayoutCalc
    + insurancePayoutCalc;

  // Reverse calc: ถ้า user ตั้ง targetPrice → หา input ของ "เงินดาวน์ออกแทน" ที่ทำให้ได้ target
  const baseExcludingDown = totalPrice - downPayoutCalc; // ยอดไม่รวมส่วนเงินดาวน์
  const tgt = Number(targetPrice || 0);
  const targetDownCalc = tgt > 0 ? (tgt - baseExcludingDown) : 0;
  const reversedDownRaw = targetDownCalc > 0 ? Math.round(targetDownCalc / 1.07) : 0;
  const additionalDown = tgt > 0 && targetDownCalc < 0 ? Math.abs(targetDownCalc) : 0;

  function printQuote() {
    if (!selectedRow) { alert("กรุณาเลือกข้อมูลรถก่อน"); return; }
    const finName = financeCompanies.find(f => String(f.company_id) === String(financeId))?.company_name || "";
    const lines = [];
    lines.push({ label: "ราคาประกาศ", value: fmt(announcedPrice || 0), bold: true });
    if (applicableMarkups.length > 0) {
      lines.push({ section: "+ บวกเพิ่ม (จากเงื่อนไขราคาขาย)" });
      applicableMarkups.forEach(m => {
        const label = m.markup_type === "finance" ? `ตามไฟแนนท์: ${m.finance_company || "-"}`
          : m.markup_type === "finance_cc" ? `ตามไฟแนนท์+CC: ${m.finance_company || "-"} (${m.cc_min || "0"}-${m.cc_max || "∞"} cc)`
          : m.markup_type === "custom" ? `กำหนดเอง: ${m.brand || ""} ${m.model_code || ""}` : m.markup_type;
        lines.push({ label: `  ${label}`, value: `+${fmt(m.markup_amount)}`, sub: true });
      });
      lines.push({ label: "รวมบวกเพิ่ม", value: `+${fmt(markupsTotal)}`, color: "#7c3aed" });
    }
    if (useDeliveryFee) lines.push({ label: "+ ค่านำพา", value: fmt(deliveryFee) });
    if (deliveryBonus > 0) lines.push({ label: "+ บวกเพิ่มค่านำพา", value: `+${fmt(deliveryBonus)}` });
    if (useDownPayout && downPayoutCalc > 0) lines.push({ label: `+ เงินดาวน์/ค่างวดออกแทน (${fmt(downPayout)} × 1.07 ปัดร้อย)`, value: `+${fmt(downPayoutCalc)}` });
    if (useInsurancePayout && insurancePayoutCalc > 0) lines.push({ label: "+ ประกันออกแทน", value: `+${fmt(insurancePayoutCalc)}` });

    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบเสนอราคา - ${selectedRow.brand_name} ${selectedRow.model_code}</title>
<style>
  body { font-family: 'Tahoma', sans-serif; padding: 16px; font-size: 13px; max-width: 480px; margin: 0 auto; }
  h2 { margin: 0 0 8px; font-size: 17px; text-align: center; color: #072d6b; }
  .date { text-align: center; color: #6b7280; font-size: 11px; margin-bottom: 12px; }
  .info { background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 12px; line-height: 1.7; }
  .info b { color: #072d6b; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e5e7eb; }
  .row.sub { font-size: 11px; color: #6b7280; padding: 2px 0; border-bottom: none; }
  .row.bold { font-weight: 700; }
  .row.section { background: #f3e8ff; color: #7c3aed; font-weight: 600; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-top: 6px; }
  .total { display: flex; justify-content: space-between; padding: 12px; background: #f0fdf4; border-radius: 8px; font-weight: 700; font-size: 17px; color: #15803d; margin-top: 12px; }
  .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #9ca3af; }
  @media print { @page { size: A6 portrait; margin: 8mm; } body { padding: 4px; } }
</style></head><body>
<h2>💰 ใบเสนอราคารถจักรยานยนต์</h2>
<div class="date">วันที่: ${new Date().toLocaleString("th-TH")}</div>
<div class="info">
  <div><b>ยี่ห้อ:</b> ${selectedRow.brand_name}</div>
  <div><b>รุ่น:</b> ${selectedRow.marketing_name || selectedRow.series_name} · <b>แบบ:</b> ${selectedRow.model_code} · <b>Type:</b> ${selectedRow.type_name}</div>
  <div><b>ประเภท:</b> ${saleType}${finName ? " · " + finName : ""}</div>
  <div><b>สาขา:</b> ${branch} (${branchName})</div>
</div>
${lines.map(l => l.section
  ? `<div class="row section">${l.section}</div>`
  : `<div class="row ${l.bold ? "bold" : ""} ${l.sub ? "sub" : ""}" style="${l.color ? `color: ${l.color};` : ""}"><span>${l.label}</span><span style="font-family: monospace;">${l.value}</span></div>`
).join("")}
<div class="total">
  <span>💰 ยอดสุทธิ</span>
  <span>${fmt(totalPrice)} บาท</span>
</div>
${targetPrice && tgt > 0 ? `<div style="margin-top:8px;padding:8px;background:#fef9c3;border-radius:6px;font-size:11px">🎯 ราคาเป้าหมาย: ${fmt(tgt)} บาท</div>` : ""}
<div class="footer">${currentUser?.name || ""} · ${currentUser?.branch || ""}</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
    w.document.close();
  }

  function reset() {
    setFilterBrand(""); setFilterMarketing(""); setFilterModel(""); setFilterType("");
    setSaleType("เงินสด"); setFinanceId("");
    setUseDeliveryFee(false); setDeliveryFee(0);
    setUseDownPayout(false); setDownPayout(0);
    setUseInsurancePayout(false); setInsurancePayout(0);
    setTargetPrice("");
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 คำนวณราคาขายรถ</h2>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {/* LEFT: Inputs */}
          <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: "0 0 12px", color: "#072d6b", fontSize: 15 }}>📋 เลือกข้อมูลรถ</h3>

            <Field label="ยี่ห้อ *">
              <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterMarketing(""); setFilterModel(""); setFilterType(""); }} style={inp}>
                <option value="">-- เลือกยี่ห้อ --</option>
                {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="รุ่น *">
              <select value={filterMarketing} onChange={e => { setFilterMarketing(e.target.value); setFilterModel(""); setFilterType(""); }} style={inp} disabled={!filterBrand}>
                <option value="">-- เลือกรุ่น --</option>
                {marketingOpts.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="แบบ *">
              <select value={filterModel} onChange={e => { setFilterModel(e.target.value); setFilterType(""); }} style={inp} disabled={!filterMarketing}>
                <option value="">-- เลือกแบบ --</option>
                {modelOpts.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Type *">
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inp} disabled={!filterModel}>
                <option value="">-- เลือก Type --</option>
                {typeOpts.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <div style={{ height: 1, background: "#e5e7eb", margin: "14px 0" }} />

            <Field label="สาขา (จาก user ที่ login)">
              <div style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, color: "#374151" }}>
                <strong style={{ color: "#0369a1" }}>{branch}</strong> ({["SCY05", "SCY06"].includes(branch) ? "ป.เปา" : "สิงห์ชัย"})
              </div>
            </Field>

            <Field label="ประเภทการขาย">
              <div style={{ display: "flex", gap: 8 }}>
                {["เงินสด", "ขายไฟแนนซ์"].map(s => (
                  <button key={s} onClick={() => setSaleType(s)} style={pill(saleType === s, s === "เงินสด" ? "#10b981" : "#7c3aed")}>{s}</button>
                ))}
              </div>
            </Field>

            {saleType === "ขายไฟแนนซ์" && (
              <Field label="ไฟแนนท์ *">
                <select value={financeId} onChange={e => setFinanceId(e.target.value)} style={inp}>
                  <option value="">-- เลือกไฟแนนท์ --</option>
                  {financeCompanies.map(f => <option key={f.company_id} value={f.company_id}>{f.company_name}</option>)}
                </select>
              </Field>
            )}

            <div style={{ height: 1, background: "#e5e7eb", margin: "14px 0" }} />
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#7c3aed" }}>⚙️ รายการปรับแต่ง</div>

            <CheckRow checked={useDeliveryFee} onChange={setUseDeliveryFee} label="ค่านำพา"
              amount={deliveryFee} onAmount={setDeliveryFee} />
            <CheckRow checked={useDownPayout} onChange={setUseDownPayout} label="เงินดาวน์/ค่างวดออกแทน"
              amount={downPayout} onAmount={setDownPayout}
              suffix={useDownPayout && Number(downPayout) > 0 ? `× 1.07 ปัดร้อย = +${fmt(downPayoutCalc)}` : ""} />
            <CheckRow checked={useInsurancePayout} onChange={setUseInsurancePayout} label="ประกันออกแทน"
              amount={insurancePayout} onAmount={setInsurancePayout} />

            <div style={{ height: 1, background: "#e5e7eb", margin: "14px 0" }} />
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#0369a1" }}>🎯 กำหนดราคาขายสุทธิที่ต้องการ</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input type="number" step="0.01" value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                style={{ ...inp, flex: 1, textAlign: "right", fontFamily: "monospace", fontSize: 15, fontWeight: 700 }} />
              <button onClick={() => setTargetPrice("")} style={{ ...btn("#6b7280"), padding: "6px 12px" }}>✕</button>
            </div>
            {tgt > 0 && (
              <div style={{ padding: 10, background: targetDownCalc >= 0 ? "#ecfdf5" : "#fef2f2", borderRadius: 6, fontSize: 12, marginBottom: 8, border: `1px solid ${targetDownCalc >= 0 ? "#a7f3d0" : "#fca5a5"}` }}>
                {targetDownCalc >= 0 ? (
                  <>
                    <div>💡 เงินดาวน์ออกแทนที่ลูกค้าได้รับ ≈ <strong style={{ color: "#15803d", fontSize: 14 }}>{fmt(reversedDownRaw)}</strong> บาท</div>
                    <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>({fmt(reversedDownRaw)} × 1.07 ปัดร้อย = +{fmt(targetDownCalc)})</div>
                    <button onClick={() => { setUseDownPayout(true); setDownPayout(reversedDownRaw); }}
                      style={{ ...btn("#10b981"), padding: "4px 12px", fontSize: 11, marginTop: 6 }}>
                      ✓ ใช้ค่านี้
                    </button>
                  </>
                ) : (
                  <>
                    <div>⚠ ราคาเป้าหมายต่ำกว่ายอดพื้นฐาน — ต้องเก็บ <strong style={{ color: "#dc2626", fontSize: 14 }}>เงินดาวน์เพิ่ม {fmt(additionalDown)}</strong> บาท</div>
                    <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>ยอดพื้นฐาน (ไม่รวมเงินดาวน์ออกแทน): {fmt(baseExcludingDown)}</div>
                  </>
                )}
              </div>
            )}

            <button onClick={reset} style={{ ...btn("#6b7280"), marginTop: 12, width: "100%" }}>🔄 ล้างค่า</button>
          </div>

          {/* RIGHT: Result */}
          <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b", fontSize: 15 }}>💵 ผลการคำนวณ</h3>
              <button onClick={printQuote} disabled={!selectedRow}
                style={{ ...btn(selectedRow ? "#0369a1" : "#9ca3af"), padding: "6px 12px", fontSize: 12, cursor: selectedRow ? "pointer" : "not-allowed" }}>
                🖨️ พิมพ์
              </button>
            </div>

            {!selectedRow ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กรุณาเลือก ยี่ห้อ / รุ่น / แบบ / Type</div>
            ) : (
              <>
                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}>
                  <div><b>ยี่ห้อ:</b> {selectedRow.brand_name}</div>
                  <div><b>รุ่น:</b> {selectedRow.marketing_name || selectedRow.series_name} · <b>แบบ:</b> {selectedRow.model_code} · <b>Type:</b> {selectedRow.type_name}</div>
                  <div><b>ประเภท:</b> {saleType} · สาขา {branch} ({branchName}) {saleType === "ขายไฟแนนซ์" && financeId && `· ${financeCompanies.find(f => String(f.company_id) === String(financeId))?.company_name || ""}`}</div>
                </div>

                <Row label="ราคาประกาศ" value={fmt(announcedPrice || 0)} color="#072d6b" warn={!announcedPrice} />

                {applicableMarkups.length > 0 && (
                  <>
                    <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#7c3aed", marginBottom: 4 }}>+ บวกเพิ่ม (จากเงื่อนไขราคาขาย)</div>
                    {applicableMarkups.map((m, i) => {
                      const label = m.markup_type === "finance" ? `ตามไฟแนนท์: ${m.finance_company || "-"}`
                        : m.markup_type === "finance_cc" ? `ตามไฟแนนท์+CC: ${m.finance_company || "-"} (${m.cc_min || "0"}-${m.cc_max || "∞"} cc)`
                        : m.markup_type === "custom" ? `กำหนดเอง: ${m.brand || ""} ${m.model_code || ""}`
                        : m.markup_type;
                      return <Row key={i} label={`  ${label}`} value={`+${fmt(m.markup_amount)}`} sub />;
                    })}
                    <Row label="รวมบวกเพิ่ม" value={`+${fmt(markupsTotal)}`} color="#7c3aed" />
                  </>
                )}

                <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />

                {useDeliveryFee && <Row label="+ ค่านำพา" value={fmt(deliveryFee)} color="#0369a1" />}
                {deliveryBonus > 0 && <Row label={`+ บวกเพิ่มค่านำพา (${(selectedRow?.brand_name || "").toLowerCase().includes("honda") || (selectedRow?.brand_name || "").toLowerCase().includes("ฮอนด้า") ? "฿500→฿2,000" : "฿500→฿1,000"})`} value={`+${fmt(deliveryBonus)}`} color="#f97316" />}
                {useDownPayout && downPayoutCalc > 0 && <Row label={`+ เงินดาวน์/ค่างวดออกแทน (${fmt(downPayout)} × 1.07 ปัดร้อย)`} value={`+${fmt(downPayoutCalc)}`} color="#0369a1" />}
                {useInsurancePayout && insurancePayoutCalc > 0 && <Row label="+ ประกันออกแทน" value={`+${fmt(insurancePayoutCalc)}`} color="#0369a1" />}

                <div style={{ height: 2, background: "#072d6b", margin: "12px 0 6px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: 10, background: "#f0fdf4", borderRadius: 8, fontWeight: 700, fontSize: 18 }}>
                  <span>💰 ยอดสุทธิ</span>
                  <span style={{ color: "#15803d" }}>{fmt(totalPrice)} บาท</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function CheckRow({ checked, onChange, label, amount, onAmount, negative, suffix }) {
  return (
    <div style={{ marginBottom: 6, padding: "6px 10px", background: checked ? "#fef3c7" : "#f9fafb", borderRadius: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", flex: 1, fontSize: 13 }}>
          <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
          <span style={{ color: negative ? "#dc2626" : "#374151" }}>{label}</span>
        </label>
        <input type="number" step="0.01" value={amount} onChange={e => onAmount(e.target.value)}
          disabled={!checked}
          style={{ ...inp, width: 120, textAlign: "right", fontFamily: "monospace" }} />
      </div>
      {suffix && <div style={{ fontSize: 11, color: "#0369a1", marginTop: 4, paddingLeft: 22 }}>{suffix}</div>}
    </div>
  );
}

function Row({ label, value, color, sub, warn }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: sub ? "2px 0" : "6px 0", fontSize: sub ? 12 : 14, color: warn ? "#dc2626" : (color || "#374151"), fontWeight: sub ? 400 : 600 }}>
      <span>{label}{warn && <span style={{ marginLeft: 6, fontSize: 11 }}>⚠ ยังไม่ตั้งราคา</span>}</span>
      <span style={{ fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

const inp = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", width: "100%" };
const btn = (color) => ({ padding: "8px 16px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13, fontWeight: 600 });
const pill = (active, color) => ({
  padding: "6px 14px", border: `2px solid ${color}`, borderRadius: 8, cursor: "pointer",
  background: active ? color : "#fff", color: active ? "#fff" : color,
  fontFamily: "Tahoma", fontSize: 13, fontWeight: 700,
});
