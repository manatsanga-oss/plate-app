#!/usr/bin/env python3
"""doorguard — ตรวจกล้องขอบประตูม้วนก่อนสั่งปิด (รันบน shoppi เป็น systemd service doorguard.service ใน venv /home/pi/pw ที่มี ultralytics)

user 2026-11-10: "กล้องหน้าร้าน 3 ตัว ตรวจว่ามีวัตถุอยู่ที่ขอบประตูไหม ถ้ามีให้หยุดการปิด" → ตกลงแบบ "รอจนว่างแล้วปิดเอง"
การทำงาน:
  1. poll door-api action close_take ทุก POLL_SEC → ได้คำขอปิด (จากปุ่ม "ปิด" บนเว็บหรือตารางเวลา) {id, shutter both/1/2}
  2. ดึงภาพสดจาก NVR ของกล้องที่เห็นขอบประตูบานนั้น (zones ใน doorguard.json) → YOLOv8s ทั้งเฟรม → วัตถุที่กล่องทับแถบขอบประตู ≥ ROI_FRAC = กีดขวาง
  3. ว่าง → close_update closing → door-api close force:true (เส้นทาง Tuya scene เดิม) → close_update closed/error
     ไม่ว่าง → close_update waiting + ภาพ (ย่อ) → รอ RETRY_SEC แล้วตรวจใหม่ จนครบ MAX_WAIT_SEC → close_update timeout + LINE แจ้งผู้ดูแลพร้อมภาพ
  ⚠️ ไม่ใช่อุปกรณ์กันหนีบ: ตรวจก่อนสั่งปิดเท่านั้น (คน/รถที่เข้ามาหลังตรวจ ระบบไม่เห็น) — ควรติดเซ็นเซอร์ลำแสงที่ขอบประตูเพิ่ม
config: ~/nvr/doorguard.json · secrets: ~/nvr/doorguard_secrets.json {line_token, line_to[], door_api}
ทดสอบ: python doorguard.py check  (ตรวจทุกบานครั้งเดียว ไม่สั่งปิด) · python doorguard.py once (รับคิว 1 รอบ)
"""
import base64, io, json, os, sys, time, traceback
import requests
from requests.auth import HTTPDigestAuth
from PIL import Image, ImageDraw

HOME = os.path.expanduser("~")
CFG_FILE = os.path.join(HOME, "nvr", "doorguard.json")
SEC_FILE = os.path.join(HOME, "nvr", "doorguard_secrets.json")
DEFAULT_CFG = {
    "nvr_host": "192.168.1.100", "nvr_user": "admin", "pw_file": os.path.join(HOME, "nvr", ".pw"),
    "model": os.path.join(HOME, "nvr", "yolov8s.pt"), "imgsz": 1280, "conf": 0.3, "roi_frac": 0.2,
    "poll_sec": 3, "retry_sec": 30, "max_wait_sec": 600,
    # ชื่อคลาส COCO ที่ถือว่ากีดขวาง (รถ/คน/ของวางพื้นที่ YOLO รู้จัก)
    "watch": ["person", "bicycle", "car", "motorcycle", "bus", "truck", "dog", "cat", "chair", "bench", "potted plant",
              "suitcase", "backpack", "handbag", "umbrella", "skateboard", "fire hydrant", "stop sign", "bottle"],
    # บาน → กล้อง + แถบขอบประตู [x0,y0,x1,y1] บนภาพ 2560x1440 (user ชี้ 2026-11-10: CH03 คอลัมน์ F = ประตูม้วน 1, CH13 คอลัมน์ A = ประตูม้วน 2 — สลับได้ถ้าผิด)
    "zones": {
        "1": {"channel": 3, "roi": [2133, 0, 2560, 1440], "name": "ประตูม้วน 1 (CH03)"},
        "2": {"channel": 13, "roi": [0, 0, 427, 1440], "name": "ประตูม้วน 2 (CH13)"},
    },
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def load_cfg():
    cfg = dict(DEFAULT_CFG)
    try:
        cfg.update(json.load(open(CFG_FILE, encoding="utf-8")))
    except FileNotFoundError:
        json.dump(DEFAULT_CFG, open(CFG_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return cfg


class Guard:
    def __init__(self):
        self.cfg = load_cfg()
        self.sec = json.load(open(SEC_FILE, encoding="utf-8"))
        self.auth = HTTPDigestAuth(self.cfg["nvr_user"], open(self.cfg["pw_file"]).read().strip())
        from ultralytics import YOLO
        self.model = YOLO(self.cfg["model"])
        self.names = self.model.names

    # ---------- door-api ----------
    def api(self, **body):
        try:
            r = requests.post(self.sec["door_api"], json=body, timeout=90)
            d = r.json()
            return d if isinstance(d, dict) else {}
        except Exception as e:
            log("api", body.get("action"), "failed:", str(e)[:120])
            return {}

    def update(self, req_id, status, note="", image_b64=None):
        body = {"action": "close_update", "request_id": req_id, "status": status, "note": note}
        if image_b64:
            body["image_base64"] = image_b64
        return self.api(**body)

    # ---------- camera + YOLO ----------
    def snapshot(self, channel):
        r = requests.get(f"http://{self.cfg['nvr_host']}/cgi-bin/snapshot.cgi?channel={channel}", auth=self.auth, timeout=10)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")

    def check_zone(self, door):
        """คืน (blocking:list, annotated PIL image) ของบานนี้"""
        z = self.cfg["zones"][str(door)]
        im = self.snapshot(z["channel"])
        res = self.model.predict(im, imgsz=self.cfg["imgsz"], conf=self.cfg["conf"], verbose=False)[0]
        x0, y0, x1, y1 = z["roi"]
        dr = ImageDraw.Draw(im, "RGBA")
        dr.rectangle([x0, y0, x1, y1], outline=(255, 255, 0, 255), width=6)
        hits = []
        for b in res.boxes:
            name = self.names[int(b.cls)]; conf = float(b.conf)
            bx0, by0, bx1, by1 = [float(v) for v in b.xyxy[0]]
            inter = max(0, min(bx1, x1) - max(bx0, x0)) * max(0, min(by1, y1) - max(by0, y0))
            area = max(1.0, (bx1 - bx0) * (by1 - by0))
            frac = inter / area
            hit = name in self.cfg["watch"] and frac >= self.cfg["roi_frac"]
            dr.rectangle([bx0, by0, bx1, by1], outline=(255, 0, 0, 255) if hit else (0, 200, 0, 160), width=6 if hit else 2)
            if hit:
                hits.append({"name": name, "conf": round(conf, 2), "frac": round(frac, 2)})
        return hits, im

    def check_doors(self, doors):
        """ตรวจทุกบานที่ขอ → (blocked:bool, note:str, image_b64|None)"""
        notes, img = [], None
        for d in doors:
            try:
                hits, im = self.check_zone(d)
            except Exception as e:
                notes.append(f"{self.cfg['zones'][str(d)]['name']}: ดึงภาพ/ตรวจไม่ได้ ({str(e)[:60]})")
                continue   # กล้องพัง = ถือว่าไม่รู้ → ไม่ปิด (ปลอดภัยไว้ก่อน) — note บอกไว้
            if hits:
                th = {"person": "คน", "motorcycle": "มอเตอร์ไซค์", "bicycle": "จักรยาน", "car": "รถยนต์", "truck": "รถบรรทุก", "bus": "รถบัส", "dog": "สุนัข", "cat": "แมว"}
                cnt = {}
                for h in hits:
                    cnt[h["name"]] = cnt.get(h["name"], 0) + 1
                notes.append(f"{self.cfg['zones'][str(d)]['name']}: " + ", ".join(f"{th.get(k, k)} {v}" for k, v in cnt.items()))
                if img is None:
                    im.thumbnail((960, 540))
                    buf = io.BytesIO(); im.save(buf, "JPEG", quality=70)
                    img = base64.b64encode(buf.getvalue()).decode()
        return (len(notes) > 0), " · ".join(notes), img

    # ---------- LINE ----------
    def line_notify(self, text, image_b64=None, req_id=None):
        tok, to = self.sec.get("line_token"), self.sec.get("line_to") or []
        if not tok or not to:
            return
        msgs = [{"type": "text", "text": text}]
        if image_b64 and req_id:
            url = f"{self.sec['door_api'].replace('/webhook/door-api', '')}/webhook/door-api-image?id={req_id}"   # (ยังไม่มี endpoint รูป → ส่งข้อความอย่างเดียว)
            url = None
            if url:
                msgs.append({"type": "image", "originalContentUrl": url, "previewImageUrl": url})
        try:
            requests.post("https://api.line.me/v2/bot/message/multicast", headers={"Authorization": tok, "Content-Type": "application/json"},
                          json={"to": to, "messages": msgs}, timeout=15)
        except Exception as e:
            log("LINE failed:", e)

    # ---------- main loop ----------
    def handle(self, req):
        rid = req["id"]; sh = str(req.get("shutter") or "both")
        doors = ["1", "2"] if sh == "both" else [sh]
        doors = [d for d in doors if str(d) in self.cfg["zones"]]
        log(f"คำขอ #{rid} ปิดบาน {sh} จาก {req.get('requested_by') or req.get('source')}")
        t0 = time.time(); last_note = None
        while True:
            blocked, note, img = self.check_doors(doors)
            # คำขอถูกยกเลิกระหว่างรอ (กดหยุด/ยกเลิก) → เลิก
            cur = (self.api(action="close_status") or {}).get("request") or {}
            if cur.get("id") == rid and cur.get("status") in ("cancelled",):
                log(f"  #{rid} ถูกยกเลิก"); return
            if not blocked:
                self.update(rid, "closing", "ขอบประตูว่าง กำลังสั่งปิด")
                r = self.api(action="close", shutter=sh, force=True, source="pi", user=f"doorguard ({req.get('requested_by') or 'ตารางเวลา'})")
                ok = bool(r.get("ok")); detail = " | ".join(f"{x.get('name')}: {'ok' if x.get('ok') else x.get('msg')}" for x in (r.get("results") or []))
                self.update(rid, "closed" if ok else "error", detail or (r.get("error") or "ไม่มีผลตอบกลับ"))
                log(f"  #{rid} {'ปิดแล้ว' if ok else 'ปิดไม่สำเร็จ'}: {detail}")
                return
            waited = int(time.time() - t0)
            if note != last_note:
                log(f"  #{rid} ติดสิ่งกีดขวาง: {note} (รอแล้ว {waited}s)")
            self.update(rid, "waiting", f"{note} — ตรวจซ้ำทุก {self.cfg['retry_sec']} วิ (รอแล้ว {waited // 60} นาที)", img if note != last_note else None)
            last_note = note
            if waited >= self.cfg["max_wait_sec"]:
                self.update(rid, "timeout", f"รอเกิน {self.cfg['max_wait_sec'] // 60} นาที ยังมีสิ่งกีดขวาง: {note} — ไม่ได้ปิดประตู")
                self.line_notify(f"🚪 ปิดประตูไม่ได้ (คำขอ #{rid} บาน {sh})\nติดสิ่งกีดขวางเกิน {self.cfg['max_wait_sec'] // 60} นาที: {note}\nกรุณาเอาออกแล้วสั่งปิดใหม่ในหน้าประตูร้าน", img, rid)
                log(f"  #{rid} timeout"); return
            time.sleep(self.cfg["retry_sec"])

    def run(self, once=False):
        log("doorguard start", {k: self.cfg[k] for k in ("poll_sec", "retry_sec", "max_wait_sec", "conf", "roi_frac")}, "zones:", {k: v["channel"] for k, v in self.cfg["zones"].items()})
        while True:
            try:
                req = (self.api(action="close_take") or {}).get("request")
                if req and req.get("id"):
                    self.handle(req)
                elif once:
                    log("ไม่มีคำขอค้าง"); return
            except Exception as e:
                log("loop error:", e); traceback.print_exc()
            if once:
                return
            time.sleep(self.cfg["poll_sec"])


if __name__ == "__main__":
    g = Guard()
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        for d in g.cfg["zones"]:
            hits, im = g.check_zone(d)
            p = f"/tmp/doorguard_ch{g.cfg['zones'][d]['channel']:02d}.jpg"; im.thumbnail((1600, 900)); im.save(p, quality=80)
            print(g.cfg["zones"][d]["name"], "→", ("กีดขวาง " + json.dumps(hits, ensure_ascii=False)) if hits else "ว่าง", "|", p)
    elif len(sys.argv) > 1 and sys.argv[1] == "once":
        g.run(once=True)
    else:
        g.run()
