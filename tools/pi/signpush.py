#!/usr/bin/env python3
"""signpush v2 — สร้างโปรแกรมจอ 1 (ป้าย Android 972S) ทั้งหมดจากสไลด์ในเมนูจอประชาสัมพันธ์ ผ่าน XiaoHui Cloud (led-cloud.com)

รันบน shoppi (Raspberry Pi ที่ร้าน ป.เปา) เป็น systemd service signpush.service — n8n บน Render ทำงานนี้ไม่ไหว (CPU 100% → ล้ม 2026-10-29)
ทำไมต้องทำแบบนี้ (2026-10-29):
  - WebView ของป้ายเล่น <video> ในหน้าเว็บแล้วแอป Magic Player ล้ม → วิดีโอต้องเล่นแบบ native
  - ป้ายไม่สลับระหว่างหลายโปรแกรมบนเครื่อง (เล่นแต่โปรแกรมแรก) → รูป+คลิปต้องอยู่ใน "โปรแกรมเดียว" ด้วยพื้นที่ Mixed Broadcast (type mixingArea)
การทำงาน (poll ทุก POLL_SEC):
  list_items → สไลด์ของจอ 1 ที่เปิดอยู่ (screen all/1, อยู่ในช่วงวันที่) เรียงตามลำดับ: image → รูป (วินาทีตาม duration_sec), video (ไฟล์ในระบบ) → คลิปซ้ำให้ครบ payload.sign_loop_sec
  ชนิดอื่น (ข้อความ/รถแนะนำ/คิว/LINE) ป้ายแสดงไม่ได้ → ข้าม
  ลายเซ็นของชุดสไลด์เปลี่ยน (เพิ่ม/ลบ/แก้/หมดอายุ/กด "ส่งขึ้นจอป้าย") → อัปโหลดไฟล์ที่ยังไม่มีบนคลาวด์ป้าย → แก้โปรแกรม MIX → ถอดโปรแกรมอื่นออกจากเครื่อง → ส่งโปรแกรม (ส่งซ้ำกันพลาด) → ลบไฟล์ที่ไม่ใช้
  สถานะเขียนกลับ payload.sign_status ของสไลด์วิดีโอ (queued/uploading/done/error) ให้เมนูแสดง
API led-cloud แกะจากหน้าเว็บ 2026-10-29 (ไม่มีเอกสาร): oauth/key + oauth/token (RSA PKCS#1 v1.5), resource/upload/multipart/{init,part,complete}, resource/list, resource/preview,
  program/{id}?format=2, program/update/{id}, task/add/program, task/add/removeProgram {programs:[program uuid], sn}, device/{sn}/programs, resource/delete
secrets: ~/nvr/signpush_secrets.json {"user": "...", "pass": "..."} (chmod 600) · state: ~/nvr/signpush_state.json
"""
import base64, hashlib, json, os, sys, time, traceback, uuid
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding

SIGNAGE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-api"
SIGNAGE_IMG = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-image?id="
BRANCH = os.environ.get("SIGNPUSH_BRANCH", "SCY06")
POLL_SEC = int(os.environ.get("SIGNPUSH_POLL", "20"))
SECRETS = os.path.expanduser("~/nvr/signpush_secrets.json")
STATE = os.path.expanduser("~/nvr/signpush_state.json")

CFG = {
    "base": "https://www.led-cloud.com",
    "oss": "https://dms-singapore.oss-ap-southeast-1.aliyuncs.com/",
    "client": "dms-browser2",
    "device": "972S-2C6-00B9B",      # จอ 1 (32" หน้าร้าน ป.เปา)
    "mix_program": 1293482,          # "PorPaor Mix (จอ 1)" — พื้นที่ Mixed Broadcast เต็มจอ (สร้างจากหน้าเว็บ 2026-10-29)
    "chunk": 5242880,
    "default_loop": 120,             # คลิปวนกี่วินาทีถ้าเมนูไม่ได้ตั้ง
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def load_state():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except Exception:
        return {"sig": "", "resources": {}}


def save_state(st):
    json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


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
    try:
        requests.post(SIGNAGE_API, json={"action": "save_item", "id": item["id"], "payload": payload}, timeout=60)
    except Exception as e:
        log("set_status failed:", e)


def screen1_slides(items):
    """สไลด์ที่จอ 1 ควรแสดงตอนนี้ เรียงตามลำดับในเมนู → [(kind, item, seconds)]"""
    today = time.strftime("%Y-%m-%d")
    out, skipped = [], []
    for it in sorted(items, key=lambda x: (int(x.get("sort_order") or 0), int(x.get("id") or 0))):
        if not it.get("active") or str(it.get("screen") or "all") not in ("all", "1"):
            continue
        sd, ed = (it.get("start_date") or "")[:10], (it.get("end_date") or "")[:10]
        if (sd and sd > today) or (ed and ed < today):
            continue
        kind = it.get("kind")
        if kind == "image" and it.get("has_image"):
            out.append(("image", it, max(3, int(it.get("duration_sec") or 10))))
        elif kind == "video" and it.get("has_image"):
            p = it.get("payload") or {}
            loop = int(p.get("sign_loop_sec") or 0) or CFG["default_loop"]
            out.append(("video", it, max(10, min(1800, loop))))
        else:
            skipped.append(f"{kind}#{it.get('id')}")
    return out, skipped


def slide_key(kind, it):
    # วิดีโอ: ห้ามใช้ updated_at (เราเขียน sign_status กลับ → updated_at เปลี่ยน → วนอัปโหลดไม่รู้จบ) ใช้ขนาดไฟล์แทน
    return f"{it['id']}@{it.get('updated_at')}" if kind == "image" else f"{it['id']}@{it.get('media_len')}"


def signature(slides):
    parts = [f"{k}:{slide_key(k, it)}:{sec}" for k, it, sec in slides]
    return hashlib.sha1("|".join(parts).encode()).hexdigest()


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
        self._call("POST", "/v1/resource/upload/multipart/complete", json={"filename": fname, "uuid": uid, "uploadId": upload_id, "chunks": chunks, "groupId": -1})

    def find_resource(self, fname, rtype):
        lst = self._call("GET", f"/v1/resource/list?type={rtype}&pageNum=1&pageSize=25&q={requests.utils.quote(fname)}&groupId=-1")["data"]["list"]
        return next((r for r in lst if r.get("name") == fname), None)

    def wait_ready(self, fname, rtype, max_sec=420):
        t0 = time.time()
        while time.time() - t0 < max_sec:
            time.sleep(5)
            res = self.find_resource(fname, rtype)
            if res and (rtype == 1 or res.get("transcodeState") == 2):
                return res
            if res and res.get("transcodeState") == 3:
                raise RuntimeError("transcode failed")
        raise RuntimeError("resource not ready (timeout)")

    def preview(self, rid):
        return self._call("POST", "/v1/resource/preview", json=[rid])["data"][0]

    def program(self, pid):
        return self._call("GET", f"/v1/program/{pid}?format=2")["data"]

    def update_program(self, pid, name, duration, data):
        self._call("POST", f"/v1/program/update/{pid}", json={"name": name, "duration": str(duration), "data": data})

    def device_programs(self, sn):
        return self._call("GET", f"/v1/device/{sn}/programs?pageNum=1&pageSize=25")["data"]["list"]

    def remove_programs(self, sn, uuids):
        return self._call("POST", "/v1/task/add/removeProgram", json={"programs": uuids, "sn": sn})["data"]

    def send(self, programs, device):
        return self._call("POST", "/v1/task/add/program", json={"interlude": False, "reset": False, "programs": programs, "devices": [device], "isSliceScreen": False})["data"]

    def all_signage_resources(self):
        out = []
        for t in (1, 2):
            lst = self._call("GET", f"/v1/resource/list?type={t}&pageNum=1&pageSize=100&q=signage_&groupId=-1")["data"]["list"]
            out += [r for r in lst if str(r.get("name", "")).startswith("signage_")]
        return out

    def delete_resources(self, ids):
        if ids:
            self._call("POST", "/v1/resource/delete", json=ids)


# ---------- build ----------
def ensure_resource(lc, st, kind, it):
    """อัปโหลดไฟล์ของสไลด์ขึ้นคลาวด์ป้าย (ถ้ายังไม่มี) → dict {id, name, path, snapshot, duration}"""
    key = slide_key(kind, it)
    cached = st["resources"].get(key)
    rtype = 1 if kind == "image" else 2
    if cached and lc.find_resource(cached["name"], rtype):
        return cached
    r = requests.get(SIGNAGE_IMG + str(it["id"]) + "&v=" + str(int(time.time())), timeout=180)
    r.raise_for_status()
    data = r.content
    if len(data) < 500:
        raise RuntimeError(f"slide #{it['id']} file empty")
    ext = "jpg" if kind == "image" else ("webm" if "webm" in str(it.get("media_mime") or "") else "mp4")
    fname = f"signage_{it['id']}_{int(time.time())}.{ext}"
    log(f"  upload #{it['id']} {kind} {len(data) / 1048576:.1f} MB → {fname}")
    lc.upload(fname, data)
    res = lc.wait_ready(fname, rtype)
    info = lc.preview(res["id"])
    rec = {"id": res["id"], "name": fname, "path": info["path"], "snapshot": info.get("snapshot") or info["path"], "duration": float(info.get("duration") or 0),
           "width": info.get("width"), "height": info.get("height")}
    st["resources"][key] = rec
    save_state(st)
    return rec


def widget_image(rec, sec):
    return {"name": rec["name"], "type": "image", "uuid": str(uuid.uuid4()),
            "attributes": {"preview": CFG["oss"] + rec["snapshot"], "resourceId": rec["id"], "src": CFG["oss"] + rec["path"],
                           "effect": {"duration": int(sec * 1000), "in": 0, "clearScreen": False, "inSpeed": 1000}, "keepAspectRatio": False}}


def widget_video(rec):
    return {"name": rec["name"], "type": "video", "uuid": str(uuid.uuid4()),
            "attributes": {"volume": 100, "preview": CFG["oss"] + rec["snapshot"], "duration": int(round(rec["duration"] * 1000)), "resourceId": rec["id"],
                           "src": CFG["oss"] + rec["path"], "originalVideo": False, "keepAspectRatio": False}}


def rebuild(slides, skipped, st, creds):
    videos = [it for k, it, _ in slides if k == "video"]
    for it in videos:
        set_status(it, sign_status="uploading", sign_error=None, sign_at=time.strftime("%Y-%m-%d %H:%M"))
    step = "login"
    try:
        lc = LedCloud(creds["user"], creds["pass"])
        lc.login()
        widgets, total, used = [], 0.0, set()
        for kind, it, sec in slides:
            step = f"upload #{it['id']}"
            rec = ensure_resource(lc, st, kind, it)
            used.add(rec["id"])
            if kind == "image":
                widgets.append(widget_image(rec, sec)); total += sec
            else:
                dur = rec["duration"] or float(it.get("duration_sec") or 10)
                copies = max(1, min(60, round(sec / dur)))
                widgets += [widget_video(rec) for _ in range(copies)]; total += copies * dur
                it["_copies"] = copies; it["_vsec"] = round(copies * dur, 1)
        step = "program"
        p = lc.program(CFG["mix_program"])
        data = p["data"]
        area = next((c for c in data.get("children") or [] if c.get("type") == "mixingArea"), None)
        if area is None:
            area = {"motion": True, "name": "mixingArea1", "attributes": {"x": 0, "y": 0, "width": p.get("width", 1080), "height": p.get("height", 1920)}, "type": "mixingArea", "widgets": [], "carousel": True, "uuid": str(uuid.uuid4())}
            data["children"] = [area]
        area["attributes"].update({"x": 0, "y": 0, "width": p.get("width", 1080), "height": p.get("height", 1920)})
        area["widgets"] = widgets
        area["dataSource"] = json.loads(json.dumps(widgets))
        area["carousel"] = True
        lc.update_program(CFG["mix_program"], p["name"], round(total, 1), data)
        step = "device"
        others = [d["uuid"] for d in lc.device_programs(CFG["device"]) if d.get("uuid") and d["uuid"] != p["uuid"]]
        if others:
            lc.remove_programs(CFG["device"], others)
            log(f"  removed {len(others)} other program(s) from device")
            time.sleep(10)
        time.sleep(20)   # ให้ไฟล์กระจายขึ้น CDN ก่อน (ส่งทันทีป้ายเคยไม่รับ)
        task = lc.send([CFG["mix_program"]], CFG["device"])
        time.sleep(60)
        try:
            lc.send([CFG["mix_program"]], CFG["device"])   # ส่งซ้ำกันพลาด
        except Exception as e:
            log("  resend skipped:", e)
        step = "cleanup"
        try:
            dead = [r["id"] for r in lc.all_signage_resources() if r["id"] not in used]
            lc.delete_resources(dead)
            st["resources"] = {k: v for k, v in st["resources"].items() if v["id"] in used}
        except Exception as e:
            log("  cleanup skipped:", e)
        for it in videos:
            set_status(it, sign_status="done", sign_error=None, sign_copies=it.get("_copies"), sign_video_sec=it.get("_vsec"), sign_task_id=task.get("id"),
                       sign_done_at=time.strftime("%Y-%m-%d %H:%M"), sign_total_sec=round(total, 1), sign_skipped=skipped)
        log(f"  done: {len(widgets)} widgets, {round(total)}s total, task {task.get('id')}, skipped {skipped}")
        return True
    except Exception as e:
        err = f"{step}: {e}"[:300]
        log("  ERROR", err)
        traceback.print_exc()
        for it in videos:
            set_status(it, sign_status="error", sign_error=err)
        return False


def tick(st, creds):
    items = api_items()
    slides, skipped = screen1_slides(items)
    if not slides:
        return
    sig = signature(slides)
    queued = any((it.get("payload") or {}).get("sign_status") == "queued" for _, it, _ in slides)
    if sig == st.get("sig") and not queued:
        return
    if sig == st.get("sig_error") and not queued:
        return   # พังแล้วกับชุดนี้ รอให้เมนูเปลี่ยนก่อนค่อยลองใหม่
    log(f"change detected: {[(k, it['id'], sec) for k, it, sec in slides]}")
    if rebuild(slides, skipped, st, creds):
        st["sig"] = sig; st.pop("sig_error", None)
    else:
        st["sig_error"] = sig
    save_state(st)


def main():
    creds = json.load(open(SECRETS, encoding="utf-8"))
    st = load_state()
    log(f"signpush v2 start branch={BRANCH} poll={POLL_SEC}s device={CFG['device']} program={CFG['mix_program']}")
    while True:
        try:
            tick(st, creds)
        except Exception as e:
            log("poll error:", e)
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "once":
        creds = json.load(open(SECRETS, encoding="utf-8"))
        st = load_state()
        if len(sys.argv) > 2 and sys.argv[2] == "force":
            st["sig"] = ""; st.pop("sig_error", None)
        tick(st, creds)
    else:
        main()
