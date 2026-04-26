# HR System — Backlog & Reference

> เอกสารสำหรับ Claude อ่านเพื่อเข้าใจสิ่งที่ทำไปแล้ว + พักไว้
> วันที่อัปเดต: 2026-04-26

---

## ✅ ที่ทำเสร็จแล้ว (Phase 1)

### Database Tables
- `hr_employees` — master พนักงาน (เงินเดือน, allowance, SSO%, PF%, OT-วันทำงาน, ก.ย.ศ, บัญชี)
- `hr_annual_holidays` — ปฏิทินวันหยุดประจำปี
- `hr_monthly_extras` — input รายเดือน (โบนัส, ภาษี, OT-ปกติ, ขาด-สาย, ค่าใช้จ่ายผู้บริหาร, ของหาย)
- `time_tracking_records` — เวลาทำงานรายวัน (upload จาก CSV)

### Frontend Pages (HR menu — เห็นเฉพาะ admin + SUKANYA)
- ข้อมูลพนักงาน (CRUD)
- ปฏิทินวันหยุด
- แสดงเวลาทำงานพนักงาน
- กรอกรายเดือน
- คำนวณเงินเดือน (final output, 23 columns เหมือน Power Query "คำนวณเงินเดือน (2)")

### Backend (`hr-api.json`)
- list/save/update hr_employees
- list/save/delete annual_holidays
- list/save/delete monthly_extras
- calc_payroll (joins ทั้งหมด + คำนวณ SSO cap 750, PF, รวมรายได้/รายจ่าย/สุทธิ)
- list_time_tracking, summary_time_tracking, list_employees

### สูตรที่ใช้
```
ประกันสังคม = MIN(salary × sso_rate, 750), ปัดเศษ
กองทุนสำรองฯ = salary × pf_rate
รวมรายได้ = salary + bonus + ot_workday + ot_holiday + meal + laundry + diligence + extra_bonus + other_income
รวมรายจ่าย = SSO + tax + PF + kosor + admin_expense + lost_items + other_expense + absence_late
รายได้สุทธิ = รวมรายได้ - รวมรายจ่าย
```

---

## ⏸️ พักไว้ (Phase 2) — Sales / Commission Module

### ตัดสินใจ
- **B (พักไว้)** — ใช้ Excel Power Query เดิมคำนวณค่าคอม → ใส่ผลรวมเข้า `hr_monthly_extras.other_income` หรือ `extra_bonus`
- จะกลับมาทำเมื่อพร้อม

### ตารางที่ต้องเพิ่ม (เมื่อกลับมาทำ)
1. **`sales_staff`** — ผูก employee กับสาขา
   ```sql
   employee_name, branch_code (SCY01-07), branch_name
   ```

2. **`motorcycle_sales`** — รายงานการขายรถ (ใบขาย)
   ```sql
   sale_invoice_no, sale_date, branch_code, sale_type (ขายปลีก/ขายไฟแนนซ์), customer_name
   ```

3. **`sales_per_invoice`** — count พนักงานต่อใบขาย (วิว หรือ aggregated table)
   ```sql
   sale_invoice_no, salesperson_count
   ```

4. **`sales_targets`** — เป้าต่อสาขา/เดือน
   ```sql
   branch_code, year_month, target_count
   ```

5. **`commission_calc_log`** — เก็บผล commission แต่ละวัน (audit)
   ```sql
   employee_name, sale_date, sale_invoice_no, branch_code, sale_type,
   sale_index_in_month, commission_amount, formula_applied
   ```

### กฎการกรอง "วันที่นับค่าคอม"

#### ค่าคอมปกติ (regular commission per sale)
สำหรับ employees ที่ master `commission_method = 'ค่าคอมปกติ'`

**สังกัด สิงห์ชัย / ป.เปา**:
- วันหยุดประจำปี + ทำงาน → ✅ นับ
- วันหยุดประจำสัปดาห์ → ✅
- ชดเชย + วันหยุด → ✅
- วันทำงาน (ไม่ใช่ลา) → ✅
- ลากิจ/ลาป่วย/ลาพักร้อน/ขาดงาน/ลาคลอดบุตร → ❌

**สังกัดอื่น**:
- วันทำงาน (ไม่ใช่ลา/ชดเชย) → ✅
- ลา/ขาด → ❌

### Logic คำนวณ commission ต่อ branch

| สาขา | ขายปลีก | ขายไฟแนนซ์ |
|---|---|---|
| **SCY01** | 0 | index ≤ เป้า → 100/คัน · index > เป้า → 300/คัน |
| **SCY04, SCY07** | 0 | index ≤ 50 → 300/(salesperson_count) · index > 50 → 300 |
| **SCY06** | (เหมือน financing) | index ≤ 40 → 0 · 41+ → 300 + ((index-41)/10)*10 |
| **SCY05** | (เหมือน financing) | index ≤ 20 → 0 · 21+ → 300 + ((index-41)/10)*10 |
| **SCY05/06 ขายไฟแนนซ์** | + bonus 300/(salesperson_count) | |

```
ค่าคอมสุทธิ = ค่าคอม-สิงห์ชัย + ค่าคอม SCY05-06 + ค่าคอม2 SCY05-06
```

### `index` คืออะไร?
ลำดับการขายในเดือนนั้นของพนักงานคนนั้นๆ — คันที่ 1, 2, 3, ...
- ใช้เปรียบเทียบกับ "เป้า" ของสาขา/เดือน
- เกินเป้า = ได้ค่าคอมสูงขึ้น

---

## 📜 Power Query Reference (เก็บไว้สำหรับ implement)

### Query 1: Commission Calculation
```m
let
    แหล่งที่มา = Excel.Workbook(...คำนวณเวลาทำงาน__2_Table...),
    เปลี่ยนแปลงชนิดแล้ว = Table.TransformColumnTypes(...),
    กรองแถวแล้ว = Table.SelectRows(เปลี่ยนแปลงชนิดแล้ว,
        each ([#"ข้อมูลพนักงาน (2).คำนวนค่าคอมปกติ"] = "ค่าคอมปกติ")),

    -- กฎกรองวันที่นับค่าคอม (สังกัด-specific)
    มีการเพิ่มคอลัมน์แบบกำหนดเองแล้ว = Table.AddColumn(กรองแถวแล้ว, "กำหนดเอง", each let
        สังกัด = [สังกัด],
        ประเภทวันหยุด = [สรุปประเภทวันหยุด],
        สถานะวันทำงาน = [สรุปวันทำงาน],
        วันหยุดไม่มีค่าคอม = {"ลากิจ", "ลาป่วย", "ลาพักร้อน", "ขาดงาน","ลาคลอดบุตร"}
    in
        if สังกัด = "สิงห์ชัย" or สังกัด = "ป.เปา" then
            if ประเภทวันหยุด = "วันหยุดประจำปี" and สถานะวันทำงาน = "วันทำงาน" then "คำนวณค่าคอม"
            else if ประเภทวันหยุด = "วันหยุดประจำปี" then null
            else if ประเภทวันหยุด = "วันหยุดประจำสัปดาห์" then "คำนวณค่าคอม"
            else if ประเภทวันหยุด = "ชดเชย" and สถานะวันทำงาน = "วันหยุด" then "คำนวณค่าคอม"
            else if สถานะวันทำงาน = "วันทำงาน" and not List.Contains(วันหยุดไม่มีค่าคอม, ประเภทวันหยุด) then "คำนวณค่าคอม"
            else null
        else
            if สถานะวันทำงาน = "วันทำงาน" and not List.Contains(วันหยุดไม่มีค่าคอม & {"ชดเชย"}, ประเภทวันหยุด) then "คำนวณค่าคอม"
            else null),

    -- JOIN กับ ข้อมูลพนักงานขาย, รายงานการขาย, จัดกลุ่ม-รถที่ขาย, เป้าสิงห์ชัย
    -- เพิ่ม index = ลำดับขายในเดือน

    -- คำนวณค่าคอม SCY01: เกินเป้า → 300, ไม่เกิน → 100, ขายปลีก → 0
    "ค่าคอม SCY01" = if [ข้อมูลพนักงานขาย.รหัสสาขา] = "SCY01" then
        if [A_รายงานการขายรถจักรยานยนต์_EX.ประเภทใบขาย] = "ขายปลีก" then 0
        else if [index] > [เป้า] then 300 else 100
    else 0,

    -- คำนวณค่าคอม SCY04, SCY07
    "ค่าคอม SCY04-07" = if [ข้อมูลพนักงานขาย.รหัสสาขา] = "SCY04" or [ข้อมูลพนักงานขาย.รหัสสาขา] = "SCY07" then
        if [index] > 50 then
            if [A_รายงานการขายรถจักรยานยนต์_EX.ประเภทใบขาย] = "ขายปลีก" then 0
            else 300
        else
            if [A_รายงานการขายรถจักรยานยนต์_EX.ประเภทใบขาย] = "ขายปลีก" then 0
            else 300/[#"จัดกลุ่ม-รถที่ขาย-ตามพนักงานขาย.จำนวน"]
    else 0,

    -- คำนวณค่าคอม SCY06: index ≤ 40 → 0, index > 40 → 300 + step 10
    -- คำนวณค่าคอม SCY05: index ≤ 20 → 0, index > 20 → 300 + step 10
    "ค่าคอม SCY05-06" = if [ข้อมูลพนักงานขาย.รหัสสาขา] = "SCY06" then
        if [index] <= 40 then 0 else 300 + Number.IntegerDivide([index]-41, 10) * 10
    else if [ข้อมูลพนักงานขาย.รหัสสาขา] = "SCY05" then
        if [index] <= 20 then 0 else 300 + Number.IntegerDivide([index]-41, 10) * 10
    else 0,

    -- Bonus SCY05-06 ขายไฟแนนซ์: + 300/(จำนวนคน)
    "ค่าคอม2 SCY05-06" = if [ข้อมูลพนักงานขาย.รหัสสาขา] = "SCY05" or "SCY06" then
        if [A_รายงานการขายรถจักรยานยนต์_EX.ประเภทใบขาย] = "ขายไฟแนนซ์" then
            300/[#"จัดกลุ่ม-รถที่ขาย-ตามพนักงานขาย.จำนวน"]
        else 0
    else 0,

    "ค่าคอมสุทธิ" = ค่าคอม-สิงห์ชัย + ค่าคอม SCY05-06 + ค่าคอม2 SCY05-06
in
    ค่าคอมสุทธิ
```

### Query 2: Salesperson Count per Invoice
```m
let
    -- กรองวันที่นับ (กฎต่างจาก commission query นิดหน่อย)
    มีการเพิ่มคอลัมน์แบบกำหนดเองแล้ว = each let
        วันหยุดไม่มีค่าคอม_สิงห์ชัย = {"ลากิจ", "ลาป่วย", "ลาพักร้อน", "ขาดงาน","ลาคลอดบุตร", "วันหยุดประจำปี"},
        วันหยุดไม่มีค่าคอม_ทั่วไป = {"ลากิจ", "ลาป่วย", "ลาพักร้อน", "ขาดงาน","ลาคลอดบุตร","วันหยุดกลางดือน"}
    in
        if สังกัด = "สิงห์ชัย" then
            if List.Contains(วันหยุดไม่มีค่าคอม_สิงห์ชัย, ประเภทวันหยุด) then
                if สรุปประเภทวันหยุด = "วันหยุดประจำปี" and สรุปวันทำงาน = "วันทำงาน" then "คำนวณค่าคอม"
                else null
            else "คำนวณค่าคอม"
        else
            if List.Contains(วันหยุดไม่มีค่าคอม_ทั่วไป, ประเภทวันหยุด) then null
            else if สรุปวันทำงาน = "วันทำงาน" then "คำนวณค่าคอม" else null,

    -- Group by เลขที่ใบขาย, COUNT pesonal
    จัดกลุ่มแถวแล้ว = Table.Group(เรียงลำดับแถวแล้ว, {"A_รายงานการขายรถจักรยานยนต์_EX.เลขที่ใบขาย"},
        {{"จำนวน", each Table.RowCount(_), Int64.Type}})
in
    จัดกลุ่มแถวแล้ว
```

---

## 🎯 หลังกลับมาทำ Phase 2

### Roadmap
1. สร้าง `sales_staff` table + ผูกกับ hr_employees
2. สร้าง `motorcycle_sales` table — import จากระบบขายเดิมหรือ upload
3. สร้าง `sales_targets` table + UI กรอกเป้า
4. SQL VIEW: `v_commission_calc(month)` — implement Power Query logic
5. UI: หน้า "คำนวณค่าคอม" ใน HR menu
6. Integrate ค่าคอมเข้า payroll auto (แทน input มือ)

### Reference files
- Power Query สูตรเต็ม: ใน chat history ของ Claude — อ่านได้จากไฟล์นี้
- `hr_monthly_extras` — temporary holding ของค่าคอม (ใช้ field `other_income` หรือ `extra_bonus`)
