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
  const [branch, setBranch] = useState("ป.เปา"); // ป.เปา | สิงห์ชัย
  const [financeId, setFinanceId] = useState("");

  // Adjustable checkboxes
  const [useDeliveryFee, setUseDeliveryFee] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [useDownPayout, setUseDownPayout] = useState(false);
  const [downPayout, setDownPayout] = useState(0);
  const [useInsurancePayout, setUseInsurancePayout] = useState(false);
  const [insurancePayout, setInsurancePayout] = useState(0);
  const [useMarkup, setUseMarkup] = useState(false);
  const [markup, setMarkup] = useState(0);

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
  function findPrice() {
    if (!selectedRow) return null;
    const matchingPriceType = priceTypes.find(pt => {
      const name = String(pt.type_name || "").toLowerCase();
      const isFinance = saleType === "ขายไฟแนนซ์";
      const branchMatch = name.includes(branch.toLowerCase());
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
    const branchGroup = branch === "ป.เปา" ? "papao" : "singchai";
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
        if (m.branch_group && m.branch_group !== "all" && m.branch_group !== branchGroup) return false;
        if (rowCC !== null) {
          if (m.cc_min && rowCC < Number(m.cc_min)) return false;
          if (m.cc_max && rowCC > Number(m.cc_max)) return false;
        }
        return true;
      }
      if (m.markup_type === "custom") {
        if (m.brand && m.brand.toLowerCase() !== brand) return false;
        if (m.model_code && m.model_code.toLowerCase() !== modelCode) return false;
        if (m.branch_group && m.branch_group !== "all" && m.branch_group !== branchGroup) return false;
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

  // คำนวณยอด
  const totalPrice = (announcedPrice || 0)
    + markupsTotal
    + deliveryBonus
    + (useDeliveryFee ? Number(deliveryFee || 0) : 0)
    + (useMarkup ? Number(markup || 0) : 0)
    - (useDownPayout ? Number(downPayout || 0) : 0)
    - (useInsurancePayout ? Number(insurancePayout || 0) : 0);

  function reset() {
    setFilterBrand(""); setFilterMarketing(""); setFilterModel(""); setFilterType("");
    setSaleType("เงินสด"); setBranch("ป.เปา"); setFinanceId("");
    setUseDeliveryFee(false); setDeliveryFee(0);
    setUseDownPayout(false); setDownPayout(0);
    setUseInsurancePayout(false); setInsurancePayout(0);
    setUseMarkup(false); setMarkup(0);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 สอบถามราคารถจักรยานยนต์</h2>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

            <Field label="สาขา">
              <div style={{ display: "flex", gap: 8 }}>
                {["ป.เปา", "สิงห์ชัย"].map(b => (
                  <button key={b} onClick={() => setBranch(b)} style={pill(branch === b, "#0369a1")}>{b}</button>
                ))}
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
            <CheckRow checked={useMarkup} onChange={setUseMarkup} label="บวกเพิ่ม"
              amount={markup} onAmount={setMarkup} />
            <CheckRow checked={useDownPayout} onChange={setUseDownPayout} label="เงินดาวน์/ค่างวดออกแทน (หัก)"
              amount={downPayout} onAmount={setDownPayout} negative />
            <CheckRow checked={useInsurancePayout} onChange={setUseInsurancePayout} label="ประกันออกแทน (หัก)"
              amount={insurancePayout} onAmount={setInsurancePayout} negative />

            <button onClick={reset} style={{ ...btn("#6b7280"), marginTop: 12, width: "100%" }}>🔄 ล้างค่า</button>
          </div>

          {/* RIGHT: Result */}
          <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: "0 0 12px", color: "#072d6b", fontSize: 15 }}>💵 ผลการคำนวณ</h3>

            {!selectedRow ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กรุณาเลือก ยี่ห้อ / รุ่น / แบบ / Type</div>
            ) : (
              <>
                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  <div><b>ยี่ห้อ:</b> {selectedRow.brand_name}</div>
                  <div><b>รุ่น:</b> {selectedRow.marketing_name || selectedRow.series_name} · <b>แบบ:</b> {selectedRow.model_code} · <b>Type:</b> {selectedRow.type_name}</div>
                  <div><b>ประเภท:</b> {saleType} ({branch}) {saleType === "ขายไฟแนนซ์" && financeId && `· ${financeCompanies.find(f => String(f.company_id) === String(financeId))?.company_name || ""}`}</div>
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
                {useMarkup && <Row label="+ บวกเพิ่ม" value={fmt(markup)} color="#0369a1" />}
                {useDownPayout && <Row label="− เงินดาวน์/ค่างวดออกแทน" value={fmt(downPayout)} color="#dc2626" />}
                {useInsurancePayout && <Row label="− ประกันออกแทน" value={fmt(insurancePayout)} color="#dc2626" />}

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

function CheckRow({ checked, onChange, label, amount, onAmount, negative }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "6px 10px", background: checked ? "#fef3c7" : "#f9fafb", borderRadius: 6 }}>
      <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", flex: 1, fontSize: 13 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span style={{ color: negative ? "#dc2626" : "#374151" }}>{label}</span>
      </label>
      <input type="number" step="0.01" value={amount} onChange={e => onAmount(e.target.value)}
        disabled={!checked}
        style={{ ...inp, width: 120, textAlign: "right", fontFamily: "monospace" }} />
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
