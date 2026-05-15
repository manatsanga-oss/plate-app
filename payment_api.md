# Payment API (QR PromptPay + Omise + n8n)

ระบบรับชำระเงินผ่าน QR PromptPay สำหรับ plate-app
ใช้ Omise (Opn Payments) เป็น payment gateway และ n8n เป็น backend orchestration

## ภาพรวม

```
[plate-app UI]  ──POST──▶  /webhook/payment-api  ──▶  Omise API  ──▶  PromptPay QR
       ▲                          │
       │                          ▼
   poll ทุก 3s                Postgres
       │                          ▲
       │                          │
[Omise]  ──webhook──▶  /webhook/payment-omise-callback  (อัพเดท status เมื่อจ่ายเสร็จ)
```

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | ใช้ทำอะไร |
|------|-----------|
| `src/pages/PaymentPage.jsx` | หน้า UI สำหรับพนักงาน |
| `payment_workflow.json` | n8n workflow หลัก (สร้าง QR / ดูสถานะ / ยกเลิก / list) |
| `payment_omise_callback_workflow.json` | n8n workflow รับ webhook จาก Omise |
| `payment_tables.sql` | DDL สร้างตาราง `payments` |

## ขั้นตอนการ Setup

### 1. สร้างตารางใน Postgres

```bash
psql $DATABASE_URL -f payment_tables.sql
```

### 2. ตั้ง Credentials ใน n8n

ใน n8n → **Credentials** → New:

**Omise Public Key** (Basic Auth)
- Username: `pkey_test_xxxxxxxx` (หรือ `pkey_live_xxx` เมื่อขึ้น production)
- Password: (เว้นว่าง)

**Omise Secret Key** (Basic Auth)
- Username: `skey_test_xxxxxxxx` (หรือ `skey_live_xxx`)
- Password: (เว้นว่าง)

> Omise ใช้ HTTP Basic Auth โดยส่ง API key เป็น username เว้น password
> ดู key ที่ https://dashboard.omise.co/keys

### 3. Import Workflows เข้า n8n

1. n8n → **Workflows** → Import from File → เลือก `payment_workflow.json`
2. ในแต่ละ node ที่มี `REPLACE_PG_CRED_ID` / `REPLACE_OMISE_*_CRED_ID` — เปิด node แล้วผูกกับ credential ที่สร้างไว้ใน step 2
3. Activate workflow
4. ทำซ้ำกับ `payment_omise_callback_workflow.json`

### 4. ตั้ง Omise Webhook

ใน Omise Dashboard → **Settings → Webhooks** → Add endpoint:

```
URL: https://n8n-new-project-gwf2.onrender.com/webhook/payment-omise-callback
Events: charge.complete, charge.create
```

### 5. ตรวจสอบ

ทดสอบยิง webhook ด้วย curl:

```bash
curl -X POST https://n8n-new-project-gwf2.onrender.com/webhook/payment-api \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_promptpay_qr",
    "amount": 100,
    "payment_type": "general",
    "customer_name": "ทดสอบ",
    "branch_code": "01",
    "created_by": "admin"
  }'
```

ควรได้ response กลับมาประมาณ:

```json
[{
  "charge_id": "chrg_test_xxx",
  "qr_image": "https://api.omise.co/charges/.../documents/.../downloads/...",
  "amount": 100,
  "status": "pending",
  "expires_at": "2026-05-15T12:34:56Z"
}]
```

## API Reference

ทุก action ส่ง POST ไปที่ `https://n8n-new-project-gwf2.onrender.com/webhook/payment-api` พร้อม body JSON

### `create_promptpay_qr` — สร้าง QR

Request:
```json
{
  "action": "create_promptpay_qr",
  "amount": 1500.00,
  "payment_type": "repair",
  "ref_no": "RJ680515001",
  "customer_name": "นายทดสอบ ระบบ",
  "customer_phone": "0812345678",
  "description": "ค่าซ่อม Honda Wave",
  "created_by": "USER01",
  "branch_code": "01",
  "branch_name": "พระประแดง"
}
```

Response:
```json
[{
  "charge_id": "chrg_xxx",
  "qr_image": "https://...",
  "amount": 1500.00,
  "status": "pending",
  "expires_at": "2026-05-15T13:00:00Z",
  "ref_no": "RJ680515001",
  "customer_name": "นายทดสอบ ระบบ"
}]
```

### `get_payment_status` — เช็คสถานะ (UI poll ทุก 3 วินาที)

Request:
```json
{ "action": "get_payment_status", "charge_id": "chrg_xxx" }
```

Response:
```json
[{ "charge_id": "chrg_xxx", "status": "paid", "paid_at": "...", "amount": 1500 }]
```

`status` มี: `pending` | `paid` | `failed` | `expired` | `cancelled`

### `cancel_payment` — ยกเลิก (เฉพาะ pending)

```json
{ "action": "cancel_payment", "charge_id": "chrg_xxx" }
```

### `list_payments` — ประวัติ

```json
{
  "action": "list_payments",
  "date_from": "2026-05-01",
  "date_to": "2026-05-31",
  "branch_code": "01"
}
```

## หมายเหตุ

- **Test mode**: ใช้ `pkey_test_*` / `skey_test_*` — QR ที่สร้างไม่ได้เรียกเก็บเงินจริง แต่ Omise มี simulator
- **Production**: เปลี่ยนเป็น `pkey_live_*` / `skey_live_*` หลังเปิดบัญชี Production แล้ว
- QR PromptPay ของ Omise หมดอายุภายใน **10 นาที** (ค่า default)
- UI เปิดให้พนักงานทุก user เข้าได้ (สิทธิ์ `payment`)
