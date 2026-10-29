#!/usr/bin/env python3
"""signpush — ส่งสไลด์วิดีโอจากเมนูจอประชาสัมพันธ์ (signage_items) ขึ้นป้าย Android 972S ผ่าน XiaoHui Cloud (led-cloud.com)

รันบน shoppi (Raspberry Pi ที่ร้าน ป.เปา) เป็น systemd service — n8n บน Render ทำงานนี้ไม่ไหว (CPU 100% → ล้ม 2026-10-29)
เหตุผลที่ต้องทำ: WebView ของป้ายเล่น <video> ในหน้าเว็บแล้วแอป Magic Player ล้ม → ต้องเล่นแบบ native ผ่านโปรแกรมของ XiaoHui

การทำงาน (poll ทุก POLL_SEC วินาที):
  list_items (signage-api) → สไลด์ kind=video มีไฟล์ + payload.sign_status == 'queued' (เมนูตั้งให้ตอนกด "ส่งขึ้นจอป้าย")
  → ตั้ง 'uploading' → ดาวน์โหลดไฟล์จาก webhook signage-image → ล็อกอิน led-cloud (RSA PKCS#1 v1.5)
  → อัปโหลด multipart (ก้อน 5 MB) → รอ transcode → resource/preview → แก้โปรแกรมวิดีโอ (เพลย์ลิสต์ซ้ำให้ครบ sign_loop_sec)
  → แก้โปรแกรมหน้าเว็บ (residence = ผลรวมวินาทีสไลด์รูป/ข้อความของจอ 1) → ส่ง 2 โปรแกรมเข้าจอ 1 → ลบไฟล์เก่า (เก็บ KEEP_RESOURCES)
  → บันทึกสถานะ done/error ลง payload (save_item)
API led-cloud แกะจากหน้าเว็บ 2026-10-29 (ไม่มีเอกสาร): ดูรายละเอียดใน tools/build_signage_sign_workflow.py (เลิกใช้) / memory signage-display-feature
secrets: ~/nvr/signpush_secrets.json {"user": "...", "pass": "..."} (chmod 600)
"""
import base64, json, os, random, sys, time, traceback, uuid
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding

SIGNAGE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-api"
SIGNAGE_IMG = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-image?id="
BRANCH = os.environ.get("SIGNPUSH_BRANCH", "SCY06")
POLL_SEC = int(os.environ.get("SIGNPUSH_POLL", "20"))
SECRETS = os.path.expanduser("~/nvr/signpush_secrets.json")

CFG = {
    "base": "https://www.led-cloud.com",
    "oss": "https://dms-singapore.oss-ap-southeast-1.aliyuncs.com/",
    "client": "dms-browser2",
    "device": "972S-2C6-00B9B",      # จอ 1 (32" หน้าร้าน ป.เปา)
    "video_program": 1293195,        # "PorPaor Video (จอ 1)"
    "web_program": 1291219,          # "PorPaor Signage 1" (HTML /signage?screen=1)
    "keep_resources": 3,
    "chunk": 5242880,
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ---------- signage-api ----------
def api_items():
    r = requests.post(SIGNAGE_API, json={"action": "list_items", "branch_code": BRANCH}, timeout=60)
    d = r.json()
    d = d[0] if isinstance(d, list) else d
    return json.loads(d.get("listjson") or "[]")


def set_status(item, **fields):
    payload = dict(item.get("payload") or {})
    payload.update(fields)
    item["payload"] = payload
    requests.post(SIGNAGE_API, json={"action": "save_item", "id": item["id"], "payload": payload}, timeout=60)


def web_secs(items):
    today = time.strftime("%Y-%m-%d")
    tot = 0
    for it in items:
        if it.get("kind") == "video" or not it.get("active"):
            continue
        if str(it.get("screen") or "all") not in ("all", "1"):
            continue
        sd, ed = (it.get("start_date") or "")[:10], (it.get("end_date") or "")[:10]
        if sd and sd > today or ed and ed < today:
            continue
        tot += int(it.get("duration_sec") or 10)
    return tot


# ---------- led-cloud ----------
class LedCloud:
    def __init__(self, user, pw):
        self.user, self.pw = user, pw
        self.s = requests.Session()
        self.token = None

    def _call(self, method, path, auth=True, token=None, **kw):
        headers = kw.pop("headers", {})
        headers.setdefault("Accept", "application/json, text/plain, */*")
        if auth:
            headers["Authorization"] = "bearer " + (token or self.token or "")
        r = self.s.request(method, CFG["base"] + path, headers=headers, timeout=120, **kw)
        try:
            j = r.json()
        except ValueError:
            j = None
        if r.status_code >= 400:
            raise RuntimeError(f"{path} → HTTP {r.status_code} {(r.text or '')[:160]}")
        if isinstance(j, dict) and "code" in j and j["code"] != 200:
            raise RuntimeError(f"{path} → {j.get('code')} {j.get('message')}")
        return j

    @staticmethod
    def rsa(pub_b64, text):
        pem = "-----BEGIN PUBLIC KEY-----\n" + pub_b64.replace("\n", "").strip() + "\n-----END PUBLIC KEY-----\n"
        key = serialization.load_pem_public_key(pem.encode())
        return base64.b64encode(key.encrypt(text.encode("utf-8"), padding.PKCS1v15())).decode()

    def login(self):
        pub = self._call("POST", "/oauth/key", auth=False)["data"]
        form = {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"}
        ct = self._call("POST", "/oauth/token", auth=False, headers=form,
                        data={"client_id": CFG["client"], "client_secret": self.rsa(pub, CFG["client"]), "grant_type": "client_credentials", "scope": "all"})
        ut = self._call("POST", "/oauth/token", token=ct["access_token"], headers=form,
                        data={"client_id": CFG["client"], "client_secret": self.rsa(pub, CFG["client"]), "grant_type": "password", "scope": "all",
                              "username": self.user.strip(), "password": self.rsa(pub, self.pw)})
        self.token = ut["access_token"]
        return self.token

    def upload(self, fname, data):
        init = self._call("POST", "/v1/resource/upload/multipart/init", json={"filename": fname})["data"]
        uid, upload_id = init["uuid"], init["uploadId"]
        ch = CFG["chunk"]
        n = max(1, (len(data) + ch - 1) // ch)
        chunks = []
        for i in range(n):
            part = data[i * ch:(i + 1) * ch]
            fields = {"md5": "undefined", "chunks": str(n), "chunksize": str(ch), "chunkNumber": str(i + 1), "filename": fname, "uuid": uid, "uploadId": upload_id}
            res = self._call("POST", "/v1/resource/upload/multipart/part", data=fields, files={"file": ("blob", part, "application/octet-stream")})
            chunks.append(res["data"]["chunk"])
            log(f"  part {i + 1}/{n} ok")
        self._call("POST", "/v1/resource/upload/multipart/complete", json={"filename": fname, "uuid": uid, "uploadId": upload_id, "chunks": chunks, "groupId": -1})
        return uid

    def wait_transcode(self, fname, max_sec=420):
        t0 = time.time()
        while time.time() - t0 < max_sec:
            time.sleep(5)
            lst = self._call("GET", f"/v1/resource/list?type=2&pageNum=1&pageSize=25&q={requests.utils.quote(fname)}&groupId=-1")["data"]["list"]
            res = next((r for r in lst if r.get("name") == fname), None)
            if res and res.get("transcodeState") == 2:
                return res
            if res and res.get("transcodeState") == 3:
                raise RuntimeError("transcode failed")
        raise RuntimeError("transcode timeout")

    def preview(self, rid):
        return self._call("POST", "/v1/resource/preview", json=[rid])["data"][0]

    def program(self, pid):
        return self._call("GET", f"/v1/program/{pid}?format=2")["data"]

    def update_program(self, pid, name, duration, data):
        self._call("POST", f"/v1/program/update/{pid}", json={"name": name, "duration": str(duration), "data": data})

    def send(self, programs, device):
        return self._call("POST", "/v1/task/add/program", json={"interlude": False, "reset": False, "programs": programs, "devices": [device], "isSliceScreen": False})["data"]

    def cleanup(self, keep_id):
        lst = self._call("GET", "/v1/resource/list?type=2&pageNum=1&pageSize=100&q=signage_&groupId=-1")["data"]["list"]
        mine = sorted([r for r in lst if r["name"].startswith("signage_") and r["id"] != keep_id], key=lambda r: str(r.get("createTime")), reverse=True)
        dead = [r["id"] for r in mine[max(0, CFG["keep_resources"] - 1):]]
        if dead:
            self._call("POST", "/v1/resource/delete", json=dead)
        return dead


def process(item, items, creds):
    pid = item["id"]
    payload = item.get("payload") or {}
    loop_sec = max(10, min(1800, int(payload.get("sign_loop_sec") or 120)))
    with_web = str(payload.get("sign_with_web", True)).lower() != "false"
    step = "start"
    try:
        set_status(item, sign_status="uploading", sign_error=None, sign_at=time.strftime("%Y-%m-%d %H:%M"))
        step = "download"
        r = requests.get(SIGNAGE_IMG + str(pid) + "&v=" + str(int(time.time())), timeout=180)
        r.raise_for_status()
        data = r.content
        if len(data) < 1000:
            raise RuntimeError(f"video file empty ({len(data)} bytes)")
        ext = "webm" if "webm" in str(item.get("media_mime") or "") else "mp4"
        fname = f"signage_{pid}_{int(time.time())}.{ext}"
        log(f"#{pid} {len(data) / 1048576:.1f} MB → {fname}")
        lc = LedCloud(creds["user"], creds["pass"])
        step = "login"; lc.login()
        step = "upload"; lc.upload(fname, data)
        step = "transcode"; res = lc.wait_transcode(fname)
        step = "preview"; info = lc.preview(res["id"])
        dur = float(info.get("duration") or res.get("duration") or item.get("duration_sec") or 10)
        copies = max(1, min(60, round(loop_sec / dur)))
        step = "program video"
        vp = lc.program(CFG["video_program"])
        vdata = vp["data"]
        area = next((c for c in vdata.get("children") or [] if c.get("type") == "video"), None)
        if area is None:
            area = {"motion": True, "name": "video1", "attributes": {"x": 0, "y": 0, "width": vp.get("width", 1080), "height": vp.get("height", 1920)}, "type": "video", "widgets": [], "carousel": True, "uuid": str(uuid.uuid4())}
            vdata["children"] = [area]
        area["widgets"] = [{"name": fname, "type": "video", "uuid": str(uuid.uuid4()),
                            "attributes": {"volume": 100, "preview": CFG["oss"] + info["snapshot"], "duration": int(round(dur * 1000)), "resourceId": res["id"],
                                           "src": CFG["oss"] + info["path"], "originalVideo": False, "keepAspectRatio": False}} for _ in range(copies)]
        area["carousel"] = True
        vdur = round(copies * dur, 1)
        lc.update_program(CFG["video_program"], vp["name"], vdur, vdata)
        wsec = web_secs(items)
        programs = [CFG["video_program"]]   # คลิปเล่นก่อน → เห็นผลทันทีหลังป้ายรับ
        if with_web and wsec > 0:
            step = "program web"
            wp = lc.program(CFG["web_program"])
            html = next((w for c in wp["data"].get("children") or [] for w in c.get("widgets") or [] if w.get("type") == "html"), None)
            if html:
                html["attributes"]["duration"] = int(wsec)
                lc.update_program(CFG["web_program"], wp["name"], int(wsec), wp["data"])
            programs = [CFG["video_program"], CFG["web_program"]]
        step = "send"
        time.sleep(20)   # ให้ไฟล์ transcode กระจายขึ้น CDN ก่อน (ส่งทันทีป้ายเคยไม่รับ 2026-10-29 15:18)
        task = lc.send(programs, CFG["device"])
        time.sleep(60)
        try:
            task2 = lc.send(programs, CFG["device"])   # ส่งซ้ำกันพลาด (idempotent: แทนที่รายการเดิม)
            log(f"  resend task {task2.get('id')}")
        except Exception as e:
            log("  resend skipped:", e)
        dead = []
        try:
            dead = lc.cleanup(res["id"])
        except Exception as e:  # ลบไม่ได้ไม่เป็นไร
            log("cleanup skipped:", e)
        set_status(item, sign_status="done", sign_error=None, sign_resource_id=res["id"], sign_resource_name=fname, sign_task_id=task.get("id"),
                   sign_copies=copies, sign_video_sec=vdur, sign_web_secs=wsec, sign_done_at=time.strftime("%Y-%m-%d %H:%M"))
        log(f"#{pid} done: {copies}x{dur:.1f}s = {vdur}s, web {wsec}s, task {task.get('id')}, deleted {dead}")
    except Exception as e:
        err = f"{step}: {e}"[:300]
        log(f"#{pid} ERROR {err}")
        traceback.print_exc()
        try:
            set_status(item, sign_status="error", sign_error=err)
        except Exception:
            pass


def main():
    creds = json.load(open(SECRETS, encoding="utf-8"))
    log(f"signpush start branch={BRANCH} poll={POLL_SEC}s device={CFG['device']}")
    while True:
        try:
            items = api_items()
            for it in items:
                p = it.get("payload") or {}
                if it.get("kind") == "video" and it.get("has_image") and p.get("sign_status") == "queued":
                    process(it, items, creds)
        except Exception as e:
            log("poll error:", e)
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "once":   # ทดสอบ: ประมวลผลคิวรอบเดียวแล้วออก
        creds = json.load(open(SECRETS, encoding="utf-8"))
        items = api_items()
        for it in items:
            if it.get("kind") == "video" and it.get("has_image") and (it.get("payload") or {}).get("sign_status") == "queued":
                process(it, items, creds)
    else:
        main()
