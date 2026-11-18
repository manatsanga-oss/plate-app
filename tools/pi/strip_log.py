#!/usr/bin/env python3
"""เก็บภาพแถบขอบประตูม้วน (ROI ของ doorguard) ทุกครั้งที่ถูกเรียก — ไว้เป็นข้อมูลปรับจูนการตรวจ "ของวางขวาง" แบบเทียบภาพอ้างอิง
(2026-11-18: YOLO จับของชิ้นเล็กไม่นิ่ง — แก้วขาวหน้าประตู 2 เจอ 2 ใน 5 เฟรม) · ไม่สั่งอุปกรณ์ ไม่โหลดโมเดล
cron: */5 * * * * /home/pi/pw/bin/python /home/pi/nvr/strip_log.py >> /home/pi/nvr/strip_log/log.txt 2>&1
เก็บ ~/nvr/strip_log/chNN/YYYYMMDD_HHMM.jpg ย้อนหลัง KEEP_DAYS วัน (ราว 60 MB/วัน)"""
import os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import doorguard as d

KEEP_DAYS = 3
OUT = os.path.join(os.path.expanduser("~"), "nvr", "strip_log")

g = d.Guard(load_model=False)
stamp = time.strftime("%Y%m%d_%H%M", time.gmtime(time.time() + 7 * 3600))   # เวลาไทย (นาฬิกา Pi เป็น GMT)
for z in g.cfg["zones"].values():
    folder = os.path.join(OUT, "ch%02d" % z["channel"])
    os.makedirs(folder, exist_ok=True)
    try:
        g.snapshot(z["channel"]).crop(tuple(z["roi"])).save(os.path.join(folder, stamp + ".jpg"), quality=88)
    except Exception as e:
        print(stamp, "ch%02d" % z["channel"], "ดึงภาพไม่ได้:", str(e)[:80])
    for f in os.listdir(folder):
        p = os.path.join(folder, f)
        if f.endswith(".jpg") and time.time() - os.path.getmtime(p) > KEEP_DAYS * 86400:
            os.remove(p)
