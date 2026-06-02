import React, { useState, useMemo } from "react";
import CustomerPickerModal from "./CustomerPickerModal";

// ============================================================================
// หน้า "บันทึกขายปลีก"
// ----------------------------------------------------------------------------
// ค้นหารถจาก "สต๊อกที่รับเข้า" (vehicle_purchase_receipts_*) ด้วยหมายเลขเครื่อง
// หรือหมายเลขตัวถัง — แสดงเฉพาะคันที่ยังไม่ขาย (sold_at IS NULL)
//   • ถ้ายังไม่ขาย  -> กรอกใบขาย แล้วบันทึก (mark สต๊อกว่าขายแล้ว -> หายจากสต๊อก)
//   • ถ้าขายแล้ว    -> แสดงใบขายเดิม + ปุ่มยกเลิก (คืนรถเข้าสต๊อก)
//
// backend: n8n webhook retail-sale-api (actions: get_vehicle / save_sale / cancel_sale)
// ============================================================================
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";

const TEAL = "#54b0b8";
const FIELD_BG = "#e9eef0";

const FINANCE_OPTIONS = [
  { value: "none", label: "ไม่จัดไฟแนนซ์" },
  { value: "moto", label: "จัดไฟแนนซ์ เฉพาะรถจักรยานยนต์" },
  { value: "moto_kit", label: "จัดไฟแนนซ์ รถจักรยานยนต์พร้อมชุดแต่ง" },
  { value: "full", label: "จัดไฟแนนซ์ ชำระเต็ม" },
];
const isFinance = (v) => v === "moto" || v === "moto_kit" || v === "full";

const text = (v) => (v ?? "").toString().trim();
const num = (v) => {
  const n = Number(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
};
const baht = (v) =>
  v === "" || v === null || v === undefined
    ? "-"
    : Number(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};

async function apiPost(payload) {
  const res = await fetch(RETAIL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  const data = raw.trim() ? JSON.parse(raw) : {};
  return Array.isArray(data) ? data[0] : data;
}

const blankForm = (currentUser) => ({
  sale_date: todayISO(),
  customer_code: "",
  customer_name: "",
  seller: currentUser?.username || currentUser?.name || "",
  note: "",
  finance_type: "none",
  car_price: "",
  discount: "",
  other_sale: "",
  down_payment: "",
  booking_deposit: "",
  finance_company_code: "",
  finance_company_name: "",
  interest_rate: "1.09",
  installments: "",
  finance_note: "",
});

export default function RetailSalePage({ currentUser }) {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [vehicle, setVehicle] = useState(null); // ข้อมูลรถจากสต๊อก + sale (ถ้ามี)
  const [mode, setMode] = useState(null); // "new" | "view" | "sold_other"
  const [form, setForm] = useState(blankForm(currentUser));
  const [showCustomer, setShowCustomer] = useState(false);

  function pickCustomer(c) {
    setForm((f) => ({
      ...f,
      customer_code: c.code || f.customer_code,
      customer_name: c.name || f.customer_name,
    }));
    setShowCustomer(false);
  }

  // ---- ยอดเงินที่คำนวณอัตโนมัติ (โหมดกรอกใหม่) ----
  const calc = useMemo(() => {
    const carPrice = num(form.car_price);
    const discount = num(form.discount);
    const otherSale = num(form.other_sale);
    const down = num(form.down_payment);
    const booking = num(form.booking_deposit);
    const netCar = Math.max(carPrice - discount, 0);
    const fin = isFinance(form.finance_type);
    const financeAmount = fin ? Math.max(netCar - down, 0) : 0;
    const r = num(form.interest_rate) / 100;
    const n = num(form.installments);
    const installment = fin && n > 0 ? (financeAmount * (1 + r * n)) / n : 0;
    const totalPayment = (fin ? down : netCar) + otherSale - booking;
    return { netCar, financeAmount, installment, totalPayment, carPrice, discount, otherSale, down, booking };
  }, [form]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function reset() {
    setVehicle(null);
    setMode(null);
    setForm(blankForm(currentUser));
  }

  async function lookup() {
    const kw = text(keyword);
    if (!kw) { setMessage("❌ กรอกหมายเลขเครื่อง / หมายเลขตัวถัง"); return; }
    setLoading(true);
    setMessage("");
    reset();
    try {
      const row = await apiPost({ action: "get_vehicle", keyword: kw });
      if (!row || (!row.stock_id && !row.engine_no)) {
        setMessage("ไม่พบรถคันนี้ในสต๊อก (อาจขายไปแล้ว หรือยังไม่ได้รับเข้า)");
        return;
      }
      setVehicle(row);
      const sale = row.sale && typeof row.sale === "object" ? row.sale : null;
      if (sale && text(sale.sale_no)) {
        setMode("view");
      } else if (row.sold_at) {
        setMode("sold_other");
      } else {
        setMode("new");
        setForm((f) => ({ ...blankForm(currentUser), car_price: row.unit_cost ? "" : "" }));
      }
    } catch (e) {
      setMessage("ค้นหาไม่สำเร็จ: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!vehicle) return;
    if (!text(form.car_price)) { setMessage("❌ กรอกราคารถ"); return; }
    if (!text(form.customer_name)) { setMessage("❌ กรอกชื่อลูกค้า"); return; }
    if (isFinance(form.finance_type) && !num(form.installments)) { setMessage("❌ กรอกจำนวนงวด"); return; }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        action: "save_sale",
        brand: vehicle.brand,
        stock_table: vehicle.stock_table,
        stock_id: vehicle.stock_id,
        unit_cost: vehicle.unit_cost,
        chassis_no: vehicle.chassis_no,
        engine_no: vehicle.engine_no,
        model_code: vehicle.model_code,
        model_year: vehicle.model_year,
        model_color: vehicle.model_color,
        model_name: vehicle.model_name,
        sale_date: form.sale_date,
        customer_code: form.customer_code,
        customer_name: form.customer_name,
        seller: form.seller,
        note: form.note,
        finance_type: form.finance_type,
        car_price: calc.carPrice,
        net_car_price: calc.netCar,
        discount: calc.discount,
        other_sale: calc.otherSale,
        down_payment: calc.down,
        booking_deposit: calc.booking,
        total_payment: calc.totalPayment,
        payment_status: "unpaid",
        tax_invoice_status: "none",
        finance_company_code: form.finance_company_code,
        finance_company_name: form.finance_company_name,
        interest_rate: num(form.interest_rate),
        installments: num(form.installments),
        finance_amount: calc.financeAmount,
        installment_amount: calc.installment,
        finance_note: form.finance_note,
        branch_code: currentUser?.branch_code || currentUser?.branch || "",
        branch_name: currentUser?.branch || "",
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const row = await apiPost(payload);
      const sale = row && (row.sale || row);
      if (!sale || !sale.sale_no) throw new Error(row?.error || row?.__error || "บันทึกไม่สำเร็จ");
      setVehicle((v) => ({ ...v, sale, sold_at: sale.sale_date, sold_invoice_no: sale.sale_no }));
      setMode("view");
      setMessage("✅ บันทึกใบขายเรียบร้อย เลขที่ " + sale.sale_no + " (ตัดออกจากสต๊อกแล้ว)");
    } catch (e) {
      setMessage("บันทึกไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    const sale = vehicle?.sale;
    if (!sale?.sale_no) return;
    if (!window.confirm(`ยกเลิกใบขาย ${sale.sale_no}? รถจะถูกคืนเข้าสต๊อก`)) return;
    setSaving(true);
    setMessage("");
    try {
      const row = await apiPost({
        action: "cancel_sale",
        sale_no: sale.sale_no,
        brand: vehicle.brand,
        cancelled_by: currentUser?.username || currentUser?.name || "system",
      });
      const c = row && (row.cancelled || row);
      if (!c || (row && (row.error || row.__error))) throw new Error(row?.error || row?.__error || "ยกเลิกไม่สำเร็จ");
      setMessage("✅ ยกเลิกใบขายแล้ว — รถคืนเข้าสต๊อก");
      reset();
      setKeyword("");
    } catch (e) {
      setMessage("ยกเลิกไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  const editable = mode === "new";
  const sale = vehicle?.sale || null;

  return (
    <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 26, color: "#333" }}>ขายปลีก</h2>
        <div style={{ color: "#9aa0a6", fontSize: 14 }}>ขายรถ &nbsp;&gt;&nbsp; การขาย &nbsp;&gt;&nbsp; ขายปลีก</div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, maxWidth: 620 }}>
        <input
          style={{ flex: 1, padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8 }}
          placeholder="กรอก/สแกนหมายเลขเครื่อง หรือหมายเลขตัวถัง"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
        />
        <button onClick={lookup} disabled={loading} style={btn("#2563eb")}>{loading ? "ค้นหา…" : "🔍 ค้นหา"}</button>
        {vehicle && <button onClick={() => { reset(); setKeyword(""); setMessage(""); }} style={btn("#8aa0a6")}>ล้าง</button>}
      </div>

      {message && (
        <div style={{ margin: "8px 0", color: message.startsWith("✅") ? "#067647" : "#b42318", fontWeight: 600 }}>{message}</div>
      )}

      {vehicle && (
        <>
          <SectionBar icon={editable ? "＋" : "📄"} title={editable ? "เพิ่มข้อมูล (ขายใหม่)" : `ใบขาย ${text(sale?.sale_no) || ""}`} />

          {mode === "sold_other" && (
            <div style={{ background: "#fffaeb", color: "#b54708", padding: 14, borderRadius: 8, marginBottom: 14 }}>
              ⚠️ รถคันนี้ถูกตัดออกจากสต๊อกแล้ว (ขายเมื่อ {thaiDate(vehicle.sold_at)}{vehicle.sold_invoice_no ? `, อ้างอิง ${vehicle.sold_invoice_no}` : ""}) — ไม่มีใบขายในระบบนี้
            </div>
          )}

          {/* ===================== ข้อมูลรถ ===================== */}
          <Card>
            <SectionHead title="ข้อมูลรถ" />
            <CardBody>
              <Grid>
                <Field label="เลขที่ใบขาย" value={<Box>{text(sale?.sale_no) || "(ออกอัตโนมัติเมื่อบันทึก)"}</Box>}
                  extra={sale?.sale_status ? <span style={{ color: "#d92d20", fontWeight: 600, marginLeft: 12 }}>{sale.sale_status === "10" ? "10 เปิดเอกสาร" : sale.sale_status}</span> : null} />
                <Field label="วันที่ขาย" required value={editable
                  ? <input type="date" value={form.sale_date} onChange={set("sale_date")} style={inp} />
                  : <Box>{thaiDate(sale?.sale_date)}</Box>} />
                <Field label="ยี่ห้อ" value={<Box>{vehicle.brand}</Box>} />
                <Field label="ราคาทุน" value={<MoneyBox>{baht(vehicle.unit_cost)}</MoneyBox>} />
                <Field label="หมายเลขตัวถัง" value={<Box>{vehicle.chassis_no || "-"}</Box>} />
                <Field label="หมายเลขเครื่อง" value={<Box>{vehicle.engine_no || "-"}</Box>} />
                <Field
                  label="รุ่น/แบบ/สี"
                  value={
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Box w={170}>{vehicle.model_code}</Box>
                      <Box w={70}>{vehicle.model_year}</Box>
                      <Box w={70}>{vehicle.model_color}</Box>
                      <span style={{ color: "#333", fontWeight: 600 }}>{vehicle.model_name}</span>
                    </div>
                  }
                  full
                />
                <Field label="รหัสลูกค้า" value={editable
                  ? <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
                      <input value={form.customer_code} onChange={set("customer_code")} placeholder="รหัสลูกค้า" style={inp} />
                      <button type="button" onClick={() => setShowCustomer(true)} style={btn("#2563eb")}>🔍 เลือก/เพิ่ม</button>
                    </div>
                  : <Box>{sale?.customer_code || "-"}</Box>} />
                <Field label="ชื่อลูกค้า" required value={editable
                  ? <input value={form.customer_name} onChange={set("customer_name")} placeholder="ชื่อ-สกุล ลูกค้า (เลือกจากปุ่ม หรือพิมพ์เอง)" style={inp} />
                  : <Box>{sale?.customer_name || "-"}</Box>} />
                <Field label="ผู้ขาย" required value={editable
                  ? <input value={form.seller} onChange={set("seller")} style={inp} />
                  : <Box>{sale?.seller || "-"}</Box>} />
                <div />
                <Field label="หมายเหตุ" full value={editable
                  ? <textarea value={form.note} onChange={set("note")} style={{ ...inp, minHeight: 60, resize: "vertical" }} />
                  : <TextArea>{sale?.note}</TextArea>} />
              </Grid>
            </CardBody>
          </Card>

          {/* ===================== ค่าใช้จ่าย ===================== */}
          {mode !== "sold_other" && (
            <Card>
              <SectionHead title="ค่าใช้จ่าย" />
              <CardBody>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "center", marginBottom: 22 }}>
                  {FINANCE_OPTIONS.map((o) => (
                    <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, cursor: editable ? "pointer" : "default" }}>
                      <input type="radio" name="finance" disabled={!editable}
                        checked={(editable ? form.finance_type : sale?.finance_type) === o.value}
                        onChange={() => editable && setForm((f) => ({ ...f, finance_type: o.value }))} />
                      {o.label}
                    </label>
                  ))}
                </div>

                <Grid>
                  <Field label="ราคารถ" required unit value={editable
                    ? <input value={form.car_price} onChange={set("car_price")} style={money} placeholder="0.00" />
                    : <MoneyBox>{baht(sale?.car_price)}</MoneyBox>} />
                  <Field label="ราคารถสุทธิ" unit value={<MoneyBox>{baht(editable ? calc.netCar : sale?.net_car_price)}</MoneyBox>} />
                  <Field label="ส่วนลด" unit value={editable
                    ? <input value={form.discount} onChange={set("discount")} style={money} placeholder="0.00" />
                    : <MoneyBox>{baht(sale?.discount)}</MoneyBox>} />
                  <Field label="ยอดขายอื่นๆ" unit value={editable
                    ? <input value={form.other_sale} onChange={set("other_sale")} style={money} placeholder="0.00" />
                    : <MoneyBox>{baht(sale?.other_sale)}</MoneyBox>} />
                  <Field label="เงินดาวน์" unit value={editable
                    ? <input value={form.down_payment} onChange={set("down_payment")} style={money} placeholder="0.00" />
                    : <MoneyBox>{baht(sale?.down_payment)}</MoneyBox>} />
                  <Field label="เงินจอง" unit value={editable
                    ? <input value={form.booking_deposit} onChange={set("booking_deposit")} style={money} placeholder="0.00" />
                    : <MoneyBox>{baht(sale?.booking_deposit)}</MoneyBox>} />
                  <Field label="รวมยอดชำระ" unit value={<MoneyBox>{baht(editable ? calc.totalPayment : sale?.total_payment)}</MoneyBox>} />
                  <div />
                </Grid>

                <div style={{ display: "flex", gap: 24, justifyContent: "flex-end", margin: "18px 6px 4px" }}>
                  <StatusFlag ok={(sale?.payment_status) === "paid"} label={(sale?.payment_status) === "paid" ? "ชำระเงินแล้ว" : "ยังไม่ชำระเงิน"} />
                  <StatusFlag ok={(sale?.tax_invoice_status) === "issued"} label="ใบกำกับภาษีรถ" />
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10 }}>
                  {editable ? (
                    <button style={btn("#2e9e4f")} disabled={saving} onClick={handleSave}>{saving ? "บันทึก…" : "💾 บันทึกการขาย"}</button>
                  ) : (
                    <button style={btn("#e03b3b")} disabled={saving} onClick={handleCancel}>{saving ? "…" : "✖ ยกเลิกใบขาย"}</button>
                  )}
                  <button style={btn("#8aa0a6")} onClick={() => { reset(); setKeyword(""); }}>⤺ ปิด</button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ===================== จัดไฟแนนซ์ ===================== */}
          {mode !== "sold_other" && isFinance(editable ? form.finance_type : sale?.finance_type) && (
            <Card>
              <SectionHead title="จัดไฟแนนซ์" />
              <CardBody>
                <Grid>
                  <Field label="บริษัทไฟแนนซ์" full value={editable
                    ? <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                        <input value={form.finance_company_code} onChange={set("finance_company_code")} placeholder="รหัส" style={{ ...inp, maxWidth: 200 }} />
                        <input value={form.finance_company_name} onChange={set("finance_company_name")} placeholder="ชื่อบริษัทไฟแนนซ์" style={inp} />
                      </div>
                    : <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Box w={200}>{sale?.finance_company_code}</Box>
                        <span style={{ color: "#333", fontWeight: 600 }}>{sale?.finance_company_name}</span>
                      </div>} />
                  <Field label="ราคารถ" unit value={<MoneyBox>{baht(editable ? calc.carPrice : sale?.car_price)}</MoneyBox>} />
                  <Field label="เงินดาวน์" unit value={<MoneyBox>{baht(editable ? calc.down : sale?.down_payment)}</MoneyBox>} />
                  <Field label="อัตราดอกเบี้ย" unitText="% (ต่อเดือน)" value={editable
                    ? <input value={form.interest_rate} onChange={set("interest_rate")} style={money} />
                    : <MoneyBox>{sale?.interest_rate}</MoneyBox>} />
                  <Field label="ยอดจัดไฟแนนซ์" unit value={<MoneyBox>{baht(editable ? calc.financeAmount : sale?.finance_amount)}</MoneyBox>} />
                  <Field label="จำนวนงวด" required unitText="งวด" value={editable
                    ? <input value={form.installments} onChange={set("installments")} style={money} placeholder="0" />
                    : <MoneyBox>{sale?.installments}</MoneyBox>} />
                  <Field label="ยอดผ่อน/งวด" unit value={<MoneyBox>{baht(editable ? calc.installment : sale?.installment_amount)}</MoneyBox>} />
                  <div />
                  <Field label="หมายเหตุ" full value={editable
                    ? <textarea value={form.finance_note} onChange={set("finance_note")} style={{ ...inp, minHeight: 60, resize: "vertical" }} />
                    : <TextArea>{sale?.finance_note}</TextArea>} />
                </Grid>
              </CardBody>
            </Card>
          )}

          {/* ===================== ใบกำกับภาษี ===================== */}
          {mode !== "sold_other" && (
            <Card>
              <SectionHead title="ใบกำกับภาษี" />
              <CardBody>
                <div style={{ color: "#98a2b3", padding: "8px 4px" }}>
                  {(sale?.tax_invoice_status) === "issued" ? "ออกใบกำกับภาษีแล้ว" : "ยังไม่ได้ออกใบกำกับภาษี"}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {showCustomer && (
        <CustomerPickerModal currentUser={currentUser} onSelect={pickCustomer} onClose={() => setShowCustomer(false)} />
      )}
    </div>
  );
}

// ============================================================================
// ส่วนประกอบย่อย (presentational)
// ============================================================================
function SectionBar({ icon, title }) {
  return (
    <div style={{ background: TEAL, color: "#fff", padding: "12px 18px", borderRadius: 8, fontWeight: 700, fontSize: 17, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.25)", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</span>
      {title}
    </div>
  );
}
function Card({ children }) {
  return <div style={{ border: "1px solid #dfe3e6", borderRadius: 10, overflow: "hidden", marginBottom: 16, background: "#eef2f3" }}>{children}</div>;
}
function SectionHead({ title }) {
  return (
    <div style={{ background: TEAL, color: "#fff", padding: "10px 18px", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "inline-flex", width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.3)", alignItems: "center", justifyContent: "center", fontSize: 12 }}>－</span>
      {title}
    </div>
  );
}
function CardBody({ children }) {
  return <div style={{ padding: "22px 26px" }}>{children}</div>;
}
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 40, rowGap: 16, alignItems: "center" }}>{children}</div>;
}
function Field({ label, required, value, full, unit, unitText, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{ width: 130, textAlign: "right", paddingRight: 14, color: "#333", fontSize: 15, flexShrink: 0 }}>
        {label}
        {required && <span style={{ color: "#d92d20" }}> *</span>}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        {typeof value === "string" || typeof value === "number" ? <Box>{value}</Box> : value}
        {unit && <span style={{ color: "#333" }}>บาท</span>}
        {unitText && <span style={{ color: "#333" }}>{unitText}</span>}
        {extra}
      </div>
    </div>
  );
}
function Box({ children, w }) {
  return (
    <div style={{ minWidth: w || 0, width: w ? w : "100%", background: FIELD_BG, border: "1px solid #d6dcde", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#333", minHeight: 20 }}>
      {children || " "}
    </div>
  );
}
function MoneyBox({ children, w }) {
  return (
    <div style={{ width: w || "100%", background: FIELD_BG, border: "1px solid #d6dcde", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#1d4ed8", textAlign: "right", fontWeight: 600 }}>
      {children || " "}
    </div>
  );
}
function TextArea({ children }) {
  return (
    <div style={{ width: "100%", background: "#fff", border: "1px solid #d6dcde", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#333", minHeight: 64 }}>
      {children || " "}
    </div>
  );
}
function StatusFlag({ ok, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: ok ? "#067647" : "#d92d20" }}>
      <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: "50%", background: ok ? "#067647" : "#e03b3b", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{ok ? "✓" : "✖"}</span>
      {label}
    </span>
  );
}

const btn = (bg) => ({ padding: "9px 16px", fontSize: 15, fontWeight: 700, color: "#fff", background: bg, border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" });
const inp = { width: "100%", background: "#fff", border: "1px solid #b9c2c6", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#333", boxSizing: "border-box" };
const money = { ...inp, textAlign: "right", color: "#1d4ed8", fontWeight: 600 };
