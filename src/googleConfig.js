// ============================================================
// Google OAuth Client ID สำหรับ Google Sign-In บนหน้า login
// วิธีสร้าง: Google Cloud Console → APIs & Services → Credentials
//   → Create OAuth client ID → Web application
//   → Authorized JavaScript origins: ใส่ทั้ง
//        https://plate-app-y1z1.onrender.com
//        http://localhost:5173
//   → คัดลอก "Client ID" (ลงท้าย .apps.googleusercontent.com) มาวางแทนค่าด้านล่าง
// ปุ่ม Google จะไม่แสดงจนกว่าจะใส่ค่าจริง (ไม่ใช่ค่า PASTE_...)
// ============================================================
export const GOOGLE_CLIENT_ID = "1080517939521-r7op1vep2cvbpvij1195u1d1e68gkvhk.apps.googleusercontent.com";

export const googleConfigured = !!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith("PASTE_");
