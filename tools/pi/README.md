# tools/pi — บริการบน Raspberry Pi 5 "shoppi" ที่ร้าน ป.เปา

- เครื่อง: Raspberry Pi 5 4GB, Raspberry Pi OS Bookworm (การ์ดที่มากับชุด Cytron), hostname `shoppi`, LAN 192.168.1.35, Tailscale 100.124.233.101 (บัญชี manatsanga@gmail.com) — เข้าได้จากทุกที่ด้วย `ssh pi@100.124.233.101` (กุญแจของคอม manat ติดตั้งแล้ว)
- NVR Dahua NVR4216-16P-4KS3 ที่ 192.168.1.100 (user admin, รหัสใน `~/nvr/.pw` บน Pi เท่านั้น) กล้อง 16 ช่อง 4MP; CH6 = ลิฟต์ซ่อม, CH12 = จุดรับรถศูนย์บริการ (อ่านป้ายท้ายรถได้ชัด)

## platewatch
- `platewatch.py` + `platewatch.service` — ดึง snapshot จาก NVR ช่องที่กำหนด → YOLOv8n หามอเตอร์ไซค์ในโซน → ส่ง `vehicle_arrived` ไป n8n `service-queue-api` 1 ครั้งต่อคัน (n8n อ่านทะเบียนด้วย GPT + บันทึก service_queue_events เหมือนกล้อง reCamera)
- ติดตั้ง: `python3 -m venv ~/pw && ~/pw/bin/pip install ultralytics opencv-python-headless requests` · คัดลอก platewatch.py ไป `~/nvr/` · config `~/nvr/platewatch.json` (คีย์ตาม DEFAULT ในสคริปต์) · `sudo cp platewatch.service /etc/systemd/system/ && sudo systemctl enable --now platewatch`
- ดู log: `journalctl -u platewatch -f` · ภาพล่าสุดพร้อมกรอบ ROI/รถ: `~/nvr/last_nvr-ch6.jpg`
