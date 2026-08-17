import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ตรึงพอร์ต plate-app ไว้ที่ 5175 ถาวร — กันชนกับ smart-farm (5173) / liff-arrival (5174)
    // และให้ตรงกับ Authorized JavaScript origins ของ Google login (http://localhost:5175)
    // strictPort: ถ้าพอร์ตไม่ว่างให้ error ไปเลย ห้ามสุ่มพอร์ตอื่น (origin จะไม่ตรงกับที่ลงทะเบียน)
    port: 5175,
    strictPort: true,
  },
})
