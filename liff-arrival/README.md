# LIFF — ยืนยันถึงที่หมาย

หน้าเว็บ LIFF ให้พนักงานขับรถกดยืนยันว่าถึงที่หมาย พร้อมส่งพิกัด GPS เข้า backend (n8n)

## โครงไฟล์

```
liff-arrival/
├── index.html   ← หน้าเดียวจบ: โหลด LIFF SDK + อ่าน GPS + POST ไป n8n
├── config.js    ← LIFF ID + URL ของ webhook (แก้ก่อน deploy)
└── README.md
```

## ก่อน deploy ต้องแก้

แก้ `config.js`:

```js
window.LIFF_CONFIG = {
  liffId: '2010078995-AXJ1tdUa',           // LIFF ID ของ "ผู้ช่วยเฮีย"
  apiUrl: 'https://n8n.your-domain/webhook/booking-api',  // ← โดเมน n8n จริง
  gpsTimeoutMs: 15000,
  gpsMaxAccuracyM: 100,    // GPS ความแม่นยำแย่กว่านี้จะไม่ยอมส่ง
  arrivalRadiusM: 200,     // ห่างจุดหมายเกินนี้ → backend คืน is_within_range=false

  requirePhoto: true,      // บังคับถ่ายรูปก่อนยืนยัน
  photoMaxWidthPx: 1280,   // ย่อรูปก่อนอัปโหลด
  photoJpegQuality: 0.85,
  cloudinary: {
    cloudName: 'YOUR_CLOUD_NAME',         // ← Cloudinary Dashboard
    uploadPreset: 'arrival_unsigned',     // ← ต้องเป็น Unsigned preset
    folder: 'arrival',
  },
};
```

### Cloudinary setup (สำหรับ photo)

1. สมัคร [cloudinary.com](https://cloudinary.com) (free tier 25GB/เดือน เกินพอ)
2. Dashboard → คัดลอก **Cloud Name**
3. Settings → Upload → **Upload presets** → Add preset
   - Signing Mode: **Unsigned**
   - Folder: `arrival` (option)
   - Tag: `arrival` (option)
   - Save → ใส่ชื่อ preset ใน config.js
4. (Recommended) Settings → Upload → Restrictions → จำกัด max file size, allowed formats เป็น `jpg, png, webp`

ถ้าไม่อยากใช้ Cloudinary ตั้ง `requirePhoto: false` → ระบบจะข้ามขั้นถ่ายรูป

## Deploy

### ตัวเลือก 1: Vercel (แนะนำ — ง่ายสุด)

```bash
cd liff-arrival
npx vercel deploy --prod
```

ครั้งแรกจะให้ login + ตั้งชื่อ project ครั้งเดียว ครั้งต่อไปแค่รันคำสั่งเดียวจบ

### ตัวเลือก 2: Netlify

```bash
cd liff-arrival
npx netlify deploy --prod --dir .
```

### ตัวเลือก 3: GitHub Pages

push folder นี้ขึ้น repo แล้วเปิด Pages ใน Settings ของ repo

## หลัง deploy

1. Copy URL ที่ deploy ได้ (เช่น `https://liff-arrival.vercel.app`)
2. เข้า [LINE Developers Console](https://developers.line.biz/console/) → channel **ผู้ช่วยเฮีย Login** → LIFF tab → เลือก LIFF app ที่มีอยู่
3. แก้ field **Endpoint URL** ให้ชี้ไป URL ที่ deploy
4. ตรวจว่า **Bot link** = `On (Aggressive)` และผูกกับ bot ผู้ช่วยเฮีย
5. ทดสอบเปิด `https://liff.line.me/2010078995-AXJ1tdUa?bookingId=TEST-001&destLat=13.7563&destLng=100.5018&destName=ทดสอบ` จากในแอป LINE

## Flow

```
LINE chat (Flex Message)
   ↓ กดปุ่ม
LIFF page (หน้านี้)
   ↓ liff.init + getProfile
   ↓ navigator.geolocation.getCurrentPosition
   ↓ POST { action: 'confirm_arrival', ... }
n8n webhook /booking-api
   ↓ บันทึก DB + คำนวณ Haversine
   ↓ push message confirm กลับเข้า LINE
   ↓ return { is_within_range, distance_from_dest }
LIFF แสดงผล + liff.closeWindow() ใน 1.5 วินาที
```

## Payload ที่ส่งไป n8n

```json
{
  "action": "confirm_arrival",
  "bookingId": "1234",
  "userId": "U1234...",
  "displayName": "สมชาย ขยันขับ",
  "lat": 13.7563,
  "lng": 100.5018,
  "accuracy": 12.5,
  "destLat": 13.7570,
  "destLng": 100.5020,
  "photoUrl": "https://res.cloudinary.com/.../arrival/abc.jpg",
  "timestamp": "2026-05-13T10:23:45.123Z",
  "idToken": "eyJhbGc..."
}
```

## Error responses

| status | error | คำอธิบาย |
|---|---|---|
| 401 | `invalid_token` | LINE verify ปฏิเสธ idToken |
| 401 | `audience_mismatch` | aud ใน token ไม่ตรง Channel ID |
| 401 | `user_mismatch` | userId payload ≠ sub ใน token |
| 401 | `token_expired` | token หมดอายุ |
| 429 | `rate_limited` | กดยืนยันซ้ำใน 30 วินาที |

n8n ตอบกลับ:

**สำเร็จ (200):**
```json
{
  "id": 123,
  "booking_id": 456,
  "is_within_range": true,
  "distance_from_dest": 87.3,
  "booker_name": "สมชาย",
  "destination_formatted": "ลาดพร้าว 71"
}
```

**ID token verify ล้มเหลว (401):**
```json
{
  "ok": false,
  "error": "invalid_token",
  "error_description": "ID token verification failed"
}
```

ค่า `error` ที่อาจได้: `invalid_token`, `audience_mismatch`, `user_mismatch`, `token_expired`

## Security: LIFF ID Token verification

ก่อนบันทึก DB ระบบจะ verify ID token ที่ส่งมา โดยยิงไป `https://api.line.me/oauth2/v2.1/verify` แล้วเช็ค:
- `sub` ต้องมี (token ออกโดย LINE จริง)
- `aud` ต้องตรงกับ LINE Login Channel ID (`2010078995`)
- `exp` ต้องยังไม่หมดอายุ
- `sub` ต้องตรงกับ `userId` ที่ส่งมาใน payload

ค่า `userId` และ `displayName` ที่บันทึกลง DB จะใช้ค่าจาก token (ไม่เชื่อค่าจาก client) เพื่อกัน spoof

## ทดสอบ local (โดยไม่ผ่าน LINE)

LIFF SDK จะตรวจว่าเปิดในแอป LINE หรือไม่ — เปิด local browser จะ login ผ่าน LINE web ก่อน
หากต้องการทดสอบ UI เฉยๆ:

```bash
cd liff-arrival
npx serve .
```

แล้วเปิด `http://localhost:3000/?bookingId=TEST&destLat=13.7&destLng=100.5&destName=ทดสอบ`
(GPS อาจไม่ได้บน HTTP — ต้อง HTTPS หรือใช้ localhost)
