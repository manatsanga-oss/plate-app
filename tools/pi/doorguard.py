#!/usr/bin/env python3
"""doorguard — ตรวจกล้องขอบประตูม้วนก่อนสั่งปิด + ตัวเชื่อม Home Assistant (รันบน shoppi เป็น systemd service doorguard.service ใน venv /home/pi/pw ที่มี ultralytics)

user 2026-11-10: "กล้องหน้าร้าน 3 ตัว ตรวจว่ามีวัตถุอยู่ที่ขอบประตูไหม ถ้ามีให้หยุดการปิด" → ตกลงแบบ "รอจนว่างแล้วปิดเอง"
การทำงาน (ตรวจกล้องก่อนปิด):
  1. เธรด poller ถาม door-api action pi_poll ทุก POLL_SEC → ได้คำขอปิด (จากปุ่ม "ปิด" บนเว็บหรือตารางเวลา) {id, shutter both/1/2}
  2. ดึงภาพสดจาก NVR ของกล้องที่เห็นขอบประตูบานนั้น (zones ใน doorguard.json) → YOLOv8s ทั้งเฟรม → วัตถุที่กล่องทับแถบขอบประตู ≥ ROI_FRAC = กีดขวาง
  3. ว่าง → close_update closing → สั่งปิด (ผ่าน Home Assistant ในเครื่อง ถ้าไม่มีใช้ door-api close force:true) → close_update closed/error
     ไม่ว่าง → close_update waiting + ภาพ (ย่อ) → รอ RETRY_SEC แล้วตรวจใหม่ จนครบ MAX_WAIT_SEC → close_update timeout + LINE แจ้งผู้ดูแลพร้อมภาพ
  ⚠️ ไม่ใช่อุปกรณ์กันหนีบ: ตรวจก่อนสั่งปิดเท่านั้น (คน/รถที่เข้ามาหลังตรวจ ระบบไม่เห็น) — ควรติดเซ็นเซอร์ลำแสงที่ขอบประตูเพิ่ม

ตัวเชื่อม Home Assistant (2026-11-16 — โควต้า Tuya IoT Core trial หมด จึงสั่งอุปกรณ์ผ่าน HA บน Pi ที่ล็อกอิน Smart Life แทน):
  - pi_poll เดียวกันได้ "commands" [{id, target, command}] ที่ n8n เข้าคิวไว้ (เปิด/หยุด/ปิดประตูจากเว็บ/LINE ฯลฯ) → เรียก HA REST ตามตารางผูกใน ~/nvr/habridge.json → ส่งผลกลับรอบถัดไป (done)
  - คำสั่งจากตารางเวลา/หน้า Smart Office (Tuya Schedule workflow เข้าคิว ha_commands เหมือนกัน): target "plug:<tuya id>" / "remote:<remote id>" command on|off|power
  - ส่งสถานะเซนเซอร์ประตู/ปลั๊กจาก HA + รายการคำสั่งที่ผูกไว้ (_cmds0…) ไปเก็บที่ n8n (states) เมื่อเปลี่ยนหรือทุก 60 วิ · pi_poll แต่ละครั้งนับเป็น heartbeat (n8n ใช้เส้นทาง HA เมื่อ heartbeat < 90 วิ)
  - HA ใช้ไม่ได้ (ไม่มี token/ล่ม) หรือ workflow ยังเป็นรุ่นเก่า → กลับไปถาม close_take แบบเดิม (ไม่มี heartbeat → n8n ใช้เส้นทาง Tuya)
config: ~/nvr/doorguard.json · secrets: ~/nvr/doorguard_secrets.json {line_token, line_to[], door_api} · HA: ~/nvr/ha_secrets.json {url, token} (วางด้วย set_ha_token.sh) + ~/nvr/habridge.json
ทดสอบ: python doorguard.py check  (ตรวจทุกบานครั้งเดียว ไม่สั่งปิด) · python doorguard.py once (รับคิว 1 รอบ) · python doorguard.py ha (เช็คการเชื่อม HA + สถานะ ไม่สั่งอุปกรณ์)
"""
import base64, io, json, os, queue, sys, threading, time, traceback
import requests
from requests.auth import HTTPDigestAuth
from PIL import Image, ImageDraw

HOME = os.path.expanduser("~")
CFG_FILE = os.path.join(HOME, "nvr", "doorguard.json")
SEC_FILE = os.path.join(HOME, "nvr", "doorguard_secrets.json")
HA_SEC_FILE = os.path.join(HOME, "nvr", "ha_secrets.json")
HA_MAP_FILE = os.path.join(HOME, "nvr", "habridge.json")
DEFAULT_CFG = {
    "nvr_host": "192.168.1.100", "nvr_user": "admin", "pw_file": os.path.join(HOME, "nvr", ".pw"),
    "model": os.path.join(HOME, "nvr", "yolov8s.pt"), "imgsz": 1280, "conf": 0.3, "roi_frac": 0.2,
    "poll_sec": 3, "retry_sec": 30, "max_wait_sec": 600,
    # ชื่อคลาส COCO ที่ถือว่ากีดขวาง (รถ/คน/ของวางพื้นที่ YOLO รู้จัก)
    "watch": ["person", "bicycle", "car", "motorcycle", "bus", "truck", "dog", "cat", "chair", "bench", "potted plant",
              "suitcase", "backpack", "handbag", "umbrella", "skateboard", "fire hydrant", "stop sign", "bottle"],
    # บาน → กล้อง + แถบขอบประตู [x0,y0,x1,y1] บนภาพ 2560x1440 (user ยืนยัน 2026-11-10: CH03 คอลัมน์ F = ประตูม้วน 1 ฝ่ายขาย, CH13 คอลัมน์ A = ประตูม้วน 2 ฝ่ายบริการ)
    "zones": {
        "1": {"channel": 3, "roi": [2133, 0, 2560, 1440], "name": "ประตูม้วน 1 (CH03)"},
        "2": {"channel": 13, "roi": [0, 0, 427, 1440], "name": "ประตูม้วน 2 (CH13)"},
    },
}
# ตารางผูกคำสั่งจาก n8n ("target:command") → บริการของ Home Assistant [domain, service, entity_id] และสถานะที่ส่งกลับ
# (entity จากการเชื่อม Tuya 2026-11-16 — ประตูม้วนสั่งผ่านฉาก Tap-to-Run ที่ HA ดึงมาเป็น scene; ประตูม้วน 2 ยังไม่มีฉาก; แอร์/ทีวีรอ user สร้างฉากในแอป Smart Life แล้วเพิ่มที่นี่)
DEFAULT_HA_MAP = {
    "commands": {
        "door1:open": ["scene", "turn_on", "scene.pratuu_1_epid"],
        "door1:stop": ["scene", "turn_on", "scene.hyud_pratuuhnaaraan"],
        "door1:close": ["scene", "turn_on", "scene.puue_pratuuhnaaraan"],
        "door2:open": ["scene", "turn_on", "scene.epidpratuu_2"],   # ฉาก "เปิดประตู 2" / "หยุดประตู 2" / "ปิดประตู 2" (user สร้างในแอป Smart Life 2026-11-16)
        "door2:stop": ["scene", "turn_on", "scene.hyudpratuu_2"],
        "door2:close": ["scene", "turn_on", "scene.pidpratuu_2"],
        "plug:eb009dfb93fb11e468r3xb:on": ["switch", "turn_on", "switch.aifsaalecchaa_socket"],
        "plug:eb009dfb93fb11e468r3xb:off": ["switch", "turn_off", "switch.aifsaalecchaa_socket"],
        # แอร์/ทีวี: 2026-11-18 user ลบฉากรวม ("เปิดแอร์"/"ปิด แอร์"/"เปิด ปิด ทีวี") แล้วทำฉากแยกตามตัวยิง IR — ผูกทีละตัวยิงเมื่อ user สร้างเสร็จ
        # ตัวยิง LCD temp/humidity IR (eb619bef17ce0d7e9behnb): Air1 + TV samsung
        "remote:eb827759879924b32aqxzr:on": ["scene", "turn_on", "scene.epidae_r_1"],    # Air1 ← ฉาก "เปิดแอร์ 1"
        "remote:eb827759879924b32aqxzr:off": ["scene", "turn_on", "scene.pidae_r_1"],   # Air1 ← ฉาก "ปิดแอร์ 1"
        # TV samsung ← ฉาก "เปิด/ปิด ทีวี Samsung" ปุ่ม Power แบบสลับ → on/off/power ชี้ฉากเดียว
        **{f"remote:eba721ad7095f75fd6soqj:{what}": ["scene", "turn_on", "scene.epid_pid_thiiwii_samsung"] for what in ("on", "off", "power")},
        # ตัวยิง Smart IR (HMS06WB3S) + IR ขาว (S06-T1-3S) — user ตั้งให้ 2 ตัวยิงคุมอุปกรณ์ชุดเดียวกัน (ฉากหนึ่งยิงจากทั้งสองตัว) · เลขแอร์ตามที่ user ตอบ 2026-11-18
        "remote:ebcaecc68ae13e7545wnqh:on": ["scene", "turn_on", "scene.epid_ae_r_2"],   # Air Mitsubishi ตัวกลาง ← "เปิด แอร์ 2"
        "remote:ebcaecc68ae13e7545wnqh:off": ["scene", "turn_on", "scene.pidae_r_2"],    # ← "ปิดแอร์ 2"
        "remote:eb9d94dc94030307f0hw3l:on": ["scene", "turn_on", "scene.epidae_r_3"],    # แอร์ Mitsubishi IR ขาว ← "เปิดแอร์ 3"
        "remote:eb9d94dc94030307f0hw3l:off": ["scene", "turn_on", "scene.pidae_r_3"],    # ← "ปิดแอร์ 3"
        "remote:ebe6c6996c7797e91f5g3p:on": ["scene", "turn_on", "scene.epidae_r_4"],    # Air TCL ← "เปิดแอร์ 4"
        "remote:ebe6c6996c7797e91f5g3p:off": ["scene", "turn_on", "scene.pidae_r_4"],    # ← "ปิดแอร์ 4"
        # TV ← ฉาก "เปิดปิด ทีวี 1" ปุ่ม Power แบบสลับ
        **{f"remote:eb070b3f31c73fee51vth8:{what}": ["scene", "turn_on", "scene.epidpid_thiiwii_1"] for what in ("on", "off", "power")},
    },
    "states": {
        "sensor:eb4e442c2dad986d38e5eu": {"entity": "binary_sensor.pratuuh_ng_faaykhaay_door", "battery": "sensor.pratuuh_ng_faaykhaay_battery"},
        "sensor:ebca18f706cd85f01eh0yh": {"entity": "binary_sensor.pratuuh_ng_faaybrikaar_door", "battery": "sensor.pratuuh_ng_faaybrikaar_battery"},
        "plug:eb009dfb93fb11e468r3xb": {"entity": "switch.aifsaalecchaa_socket"},
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


class HA:
    """Home Assistant REST ในเครื่อง (token อยู่ใน ha_secrets.json chmod 600 — ไม่ log token)"""
    def __init__(self):
        self.url, self.token = "", ""
        try:
            s = json.load(open(HA_SEC_FILE, encoding="utf-8"))
            self.url, self.token = str(s.get("url") or "http://127.0.0.1:8123").rstrip("/"), str(s.get("token") or "")
        except Exception:
            pass
        try:
            self.map = json.load(open(HA_MAP_FILE, encoding="utf-8"))
        except FileNotFoundError:
            self.map = DEFAULT_HA_MAP
            json.dump(DEFAULT_HA_MAP, open(HA_MAP_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        except Exception as e:
            log("habridge.json อ่านไม่ได้ ใช้ค่าเริ่มต้น:", e); self.map = DEFAULT_HA_MAP
        self.map.setdefault("commands", {}); self.map.setdefault("states", {})
        self._recent = {}   # (domain, service, entity) → เวลาเรียกล่าสุด
        # ฉากที่รีโมท "หลายตัว" ใช้ร่วมกัน (เช่น ฉากรวมเปิดแอร์ทุกเครื่อง) — เฉพาะฉากแบบนี้เท่านั้นที่ต้องรวมคำสั่งซ้ำ
        owners = {}
        for k, m in self.map["commands"].items():
            if k.startswith("remote:") and isinstance(m, list) and len(m) >= 3:
                owners.setdefault((m[0], m[1], m[2]), set()).add(k.rsplit(":", 1)[0])
        self._shared = {c for c, t in owners.items() if len(t) > 1}

    def _h(self):
        return {"Authorization": "Bearer " + self.token, "Content-Type": "application/json"}

    def alive(self):
        if not self.token:
            return False
        try:
            return requests.get(self.url + "/api/", headers=self._h(), timeout=4).status_code == 200
        except Exception:
            return False

    def has(self, target, command):
        return f"{target}:{command}" in self.map["commands"]

    def run(self, target, command):
        """สั่งตามตารางผูก → (ok, ข้อความ)"""
        key = f"{target}:{command}"
        m = self.map["commands"].get(key)
        if not m:
            return False, f"ยังไม่ได้ผูก {key} กับ Home Assistant (habridge.json)"
        # รีโมทหลายตัวผูกฉากเดียวกันได้ (เช่น ฉาก "เปิดแอร์" คุมแอร์ทุกเครื่อง) → ถึงเวลาเดียวกันเรียกฉากครั้งเดียวพอ
        # ฉากแยกเครื่อง (รีโมทเดียวต่อฉาก) ต้องยิงทุกครั้งที่กด — เดิมรวมทุกฉาก 30 วิ ทำให้กดปิด→เปิด→ปิดเร็ว ๆ แล้วคำสั่งหลังหาย
        call = (m[0], m[1], m[2])
        if call in self._shared and time.time() - self._recent.get(call, 0) < 30:
            return True, f"{m[2]} ok (รวมกับคำสั่งก่อนหน้า)"
        try:
            r = requests.post(f"{self.url}/api/services/{m[0]}/{m[1]}", headers=self._h(), json={"entity_id": m[2]}, timeout=15)
            if r.status_code == 200:
                self._recent[call] = time.time()
            return (r.status_code == 200), (f"{m[2]} ok" if r.status_code == 200 else f"HA http {r.status_code} {r.text[:80]}")
        except Exception as e:
            return False, f"HA เรียกไม่ได้: {str(e)[:80]}"

    def state(self, entity):
        try:
            r = requests.get(f"{self.url}/api/states/{entity}", headers=self._h(), timeout=4)
            return r.json().get("state") if r.status_code == 200 else None
        except Exception:
            return None

    def snapshot_states(self):
        out = {}
        for key, spec in self.map["states"].items():
            s = self.state(spec.get("entity", ""))
            if s in (None, "unavailable", "unknown"):
                continue
            if key.startswith("sensor:"):
                v = {"open": s == "on"}
                if spec.get("battery"):
                    b = self.state(spec["battery"])
                    try:
                        v["battery"] = int(float(b))
                    except Exception:
                        pass
                out[key] = v
            else:
                out[key] = {"on": s == "on"}
        # รายการคำสั่งที่ผูกไว้ (ให้ workflow ตั้งเวลา Tuya Schedule รู้ว่าอุปกรณ์ไหนสั่งผ่าน HA ได้ ที่เหลือใช้ Tuya OpenAPI เดิม)
        # แบ่งเป็นก้อน _cmds0, _cmds1, … ก้อนละไม่เกิน ~350 ตัวอักษร (door-api ตัดค่า state ที่ 400)
        chunk, n = [], 0
        for k in sorted(self.map["commands"]):
            if chunk and len(json.dumps({"l": chunk + [k]})) > 350:
                out[f"_cmds{n}"] = {"l": chunk}; chunk, n = [], n + 1
            chunk.append(k)
        if chunk:
            out[f"_cmds{n}"] = {"l": chunk}
        return out


class Guard:
    def __init__(self, load_model=True):
        self.cfg = load_cfg()
        self.sec = json.load(open(SEC_FILE, encoding="utf-8"))
        self.auth = HTTPDigestAuth(self.cfg["nvr_user"], open(self.cfg["pw_file"]).read().strip())
        self.ha = HA()
        self.q = queue.Queue()      # คำขอปิดประตูจากเธรด poller → เธรดหลัก (ตรวจกล้อง)
        self.current = None         # id คำขอที่กำลังทำ (กันรับซ้ำ)
        if load_model:
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
        # รอบ 2: ซูมเฉพาะแถบขอบประตู — ของชิ้นเล็ก (ขวด/กล่อง/รองเท้า) ในภาพเต็ม 2560px เล็กเกินจน YOLO มองไม่เห็น
        # (เคส 2026-11-18 ขวดหน้าประตู 2: ภาพเต็มไม่เจอเลย, ซูมแล้วเจอเป็น "bird" 0.43) → ในแถบนี้เจออะไรก็ถือว่ากีดขวาง ไม่สนชื่อคลาส
        small = []
        try:
            res2 = self.model.predict(im.crop((x0, y0, x1, y1)), imgsz=self.cfg["imgsz"], conf=self.cfg.get("crop_conf", self.cfg["conf"]), verbose=False)[0]
            for b in res2.boxes:
                cx0, cy0, cx1, cy1 = [float(v) for v in b.xyxy[0]]
                bx0, by0, bx1, by1 = cx0 + x0, cy0 + y0, cx1 + x0, cy1 + y0
                # กล่องที่ชนขอบแถบด้านที่ติดลานจอด = ของชิ้นใหญ่ที่ยื่นเข้ามา (รถ) → ให้รอบภาพเต็มตัดสินด้วย roi_frac
                m = 8
                cut = (x0 > m and bx0 <= x0 + m) or (x1 < im.width - m and bx1 >= x1 - m) or (y0 > m and by0 <= y0 + m) or (y1 < im.height - m and by1 >= y1 - m)
                if not cut:
                    small.append((self.names[int(b.cls)], float(b.conf), bx0, by0, bx1, by1))
        except Exception as e:
            log("ตรวจรอบซูมไม่ได้:", str(e)[:80])
        dr = ImageDraw.Draw(im, "RGBA")
        dr.rectangle([x0, y0, x1, y1], outline=(255, 255, 0, 255), width=6)
        hits = []
        for name, conf, bx0, by0, bx1, by1 in small:
            dr.rectangle([bx0, by0, bx1, by1], outline=(255, 0, 0, 255), width=6)
            hits.append({"name": name if name in self.cfg["watch"] else "object", "conf": round(conf, 2), "frac": 1.0, "cls": name})
        for b in res.boxes:
            name = self.names[int(b.cls)]; conf = float(b.conf)
            bx0, by0, bx1, by1 = [float(v) for v in b.xyxy[0]]
            inter = max(0, min(bx1, x1) - max(bx0, x0)) * max(0, min(by1, y1) - max(by0, y0))
            area = max(1.0, (bx1 - bx0) * (by1 - by0))
            frac = inter / area
            hit = name in self.cfg["watch"] and frac >= self.cfg["roi_frac"]
            if hit and any(min(bx1, s[4]) > max(bx0, s[2]) and min(by1, s[5]) > max(by0, s[3]) and bx0 >= x0 - 8 and bx1 <= x1 + 8 for s in small):
                hit = False   # ของชิ้นเดียวกับที่รอบซูมนับไปแล้ว
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
                th = {"person": "คน", "motorcycle": "มอเตอร์ไซค์", "bicycle": "จักรยาน", "car": "รถยนต์", "truck": "รถบรรทุก", "bus": "รถบัส", "dog": "สุนัข", "cat": "แมว", "bottle": "ขวด", "object": "วัตถุวางอยู่"}
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
        msgs = [{"type": "text", "text": text}]   # (ยังไม่มี endpoint รูป → ส่งข้อความอย่างเดียว)
        try:
            requests.post("https://api.line.me/v2/bot/message/multicast", headers={"Authorization": tok, "Content-Type": "application/json"},
                          json={"to": to, "messages": msgs}, timeout=15)
        except Exception as e:
            log("LINE failed:", e)

    # ---------- สั่งปิดจริง (หลังตรวจว่าขอบประตูว่าง) ----------
    def close_now(self, sh, who):
        """คืน (ok, detail) — HA ในเครื่องใช้ได้: สั่งฉากปิดตรง ๆ (เร็ว ไม่อ้อมผ่าน n8n) · ไม่งั้น door-api close force (เส้นทาง Tuya เดิม)"""
        if self.ha.alive():
            res = []
            for d in (["1", "2"] if sh == "both" else [sh]):
                name = f"ประตูม้วน {d}"
                ok, msg = self.ha.run(f"door{d}", "close") if self.ha.has(f"door{d}", "close") else (False, "ยังไม่มีฉากปิดใน Home Assistant")
                res.append((name, ok, msg))
            return all(r[1] for r in res), " | ".join(f"{n}: {'ok' if ok else msg}" for n, ok, msg in res)
        r = self.api(action="close", shutter=sh, force=True, source="pi", user=f"doorguard ({who})")
        detail = " | ".join(f"{x.get('name')}: {'ok' if x.get('ok') else x.get('msg')}" for x in (r.get("results") or []))
        return bool(r.get("ok")), detail or (r.get("error") or "ไม่มีผลตอบกลับ")

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
                ok, detail = self.close_now(sh, req.get("requested_by") or "ตารางเวลา")
                self.update(rid, "closed" if ok else "error", detail)
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

    def poll_once(self, st):
        """1 รอบของ poller: st = dict สถานะข้ามรอบ {done, last_states, last_push, mode}"""
        ha_ok = self.ha.alive()
        if ha_ok:
            body = {"action": "pi_poll"}
            if st["done"]:
                body["done"] = st["done"]
            states = self.ha.snapshot_states()
            if states != st["last_states"] or time.time() - st["last_push"] > 60:
                body["states"] = states
            r = self.api(**body)
            if r.get("ok") and "commands" in r:
                if st["mode"] != "ha":
                    log("โหมด Home Assistant: รับคำสั่งผ่าน pi_poll"); st["mode"] = "ha"
                st["done"] = []
                if "states" in body:
                    st["last_states"], st["last_push"] = states, time.time()
                for c in r.get("commands") or []:
                    ok, msg = self.ha.run(str(c.get("target")), str(c.get("command")))
                    log(f"HA คำสั่ง #{c.get('id')} {c.get('target')} {c.get('command')} จาก {c.get('requested_by') or c.get('source')}: {'ok' if ok else msg}")
                    st["done"].append({"id": c.get("id"), "ok": ok, "msg": msg, "target": c.get("target"), "command": c.get("command")})
                return r.get("close_request")
            # workflow ยังเป็นรุ่นเก่า (ไม่รู้จัก pi_poll) → ตกไปใช้ close_take ด้านล่าง
        if st["mode"] != "legacy":
            log("โหมดเดิม: ถาม close_take (" + ("workflow ยังไม่รองรับ pi_poll" if ha_ok else "Home Assistant ใช้ไม่ได้/ยังไม่ตั้ง token") + ")"); st["mode"] = "legacy"
        return (self.api(action="close_take") or {}).get("request")

    def poller(self):
        st = {"done": [], "last_states": None, "last_push": 0, "mode": ""}
        while True:
            try:
                req = self.poll_once(st)
                if req and req.get("id") and req.get("id") != self.current and self.q.empty():
                    self.q.put(req)
            except Exception as e:
                log("poll error:", e); traceback.print_exc()
            time.sleep(self.cfg["poll_sec"])

    def run(self, once=False):
        log("doorguard start", {k: self.cfg[k] for k in ("poll_sec", "retry_sec", "max_wait_sec", "conf", "roi_frac")}, "zones:", {k: v["channel"] for k, v in self.cfg["zones"].items()},
            "| HA:", "พร้อม" if self.ha.alive() else "ไม่พร้อม", "| คำสั่งที่ผูก:", len(self.ha.map["commands"]))
        if once:
            req = self.poll_once({"done": [], "last_states": None, "last_push": 0, "mode": ""})
            if req and req.get("id"):
                self.handle(req)
            else:
                log("ไม่มีคำขอค้าง")
            return
        threading.Thread(target=self.poller, daemon=True).start()
        while True:
            try:
                req = self.q.get()
                self.current = req.get("id")
                self.handle(req)
            except Exception as e:
                log("loop error:", e); traceback.print_exc()
            finally:
                self.current = None


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "ha":      # เช็คการเชื่อม Home Assistant (ไม่โหลด YOLO ไม่สั่งอุปกรณ์)
        g = Guard(load_model=False)
        print("HA alive:", g.ha.alive(), "| url:", g.ha.url, "| token:", "มี" if g.ha.token else "ไม่มี")
        print("commands:", ", ".join(sorted(g.ha.map["commands"])))
        print("states:", json.dumps(g.ha.snapshot_states(), ensure_ascii=False))
        sys.exit(0)
    g = Guard()
    if arg == "check":
        for d in g.cfg["zones"]:
            hits, im = g.check_zone(d)
            p = f"/tmp/doorguard_ch{g.cfg['zones'][d]['channel']:02d}.jpg"; im.thumbnail((1600, 900)); im.save(p, quality=80)
            print(g.cfg["zones"][d]["name"], "→", ("กีดขวาง " + json.dumps(hits, ensure_ascii=False)) if hits else "ว่าง", "|", p)
    elif arg == "once":
        g.run(once=True)
    else:
        g.run()
