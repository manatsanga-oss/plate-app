# สร้างรูปย่อ (thumb_data, JPEG ≤ 360px) ให้รูปอะไหล่หมุนเร็วที่มีอยู่แล้วทั้งหมด สำหรับจอคีออสเบิกอะไหล่ (Kiosk7)
# ใช้ครั้งเดียวหลัง re-import Fast_Moving_API.json (มี action get_part_thumb / save_part_thumb) — รูปใหม่ที่อัปโหลดจากหน้าเว็บจะมี thumb ให้เอง
# วิธีใช้:  python tools/backfill_part_thumbs.py            (ข้ามรหัสที่มี thumb แล้ว)
#          python tools/backfill_part_thumbs.py --force    (ทำใหม่ทุกรหัส)
import base64, io, json, sys, time, urllib.request
from PIL import Image

API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api"
MAX_PX, QUALITY = 360, 80
force = "--force" in sys.argv

def post(payload, timeout=120):
    req = urllib.request.Request(API, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8")
    try:
        d = json.loads(raw)
    except Exception:
        return None
    return d[0] if isinstance(d, list) and d else (d if isinstance(d, dict) else None)

def data_url_to_thumb(data_url):
    b = base64.b64decode(data_url.split(",", 1)[1])
    im = Image.open(io.BytesIO(b))
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255)); bg.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1]); im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((MAX_PX, MAX_PX))
    out = io.BytesIO(); im.save(out, "JPEG", quality=QUALITY, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode("ascii"), im.size, len(out.getvalue())

rows = json.loads(urllib.request.urlopen(urllib.request.Request(API, data=b'{"action":"get_fast_moving_report"}', headers={"Content-Type": "application/json"}), timeout=180).read().decode("utf-8"))
targets = [r for r in rows if r.get("has_image")]
print(f"รหัสที่มีรูป {len(targets)} รายการ")
done = skipped = failed = 0
for i, r in enumerate(targets, 1):
    pid, code = r["id"], r["part_code"]
    try:
        if not force:
            t = post({"action": "get_part_thumb", "id": pid})
            if t and t.get("thumb_data"):
                skipped += 1; continue
        full = post({"action": "get_part_image", "id": pid}, timeout=180)
        if not full or not full.get("image_data"):
            print(f"[{i}/{len(targets)}] {code}: ไม่มี image_data"); failed += 1; continue
        thumb, size, nbytes = data_url_to_thumb(full["image_data"])
        res = post({"action": "save_part_thumb", "id": pid, "thumb_data": thumb})
        ok = bool(res and res.get("part_id"))
        print(f"[{i}/{len(targets)}] {code}: {size[0]}x{size[1]} {nbytes // 1024}KB -> {'OK' if ok else 'FAIL ' + str(res)}")
        done += ok; failed += (not ok)
        time.sleep(0.2)
    except Exception as e:
        print(f"[{i}/{len(targets)}] {code}: ERROR {e}"); failed += 1
print(f"เสร็จ: ทำใหม่ {done}, มีอยู่แล้ว {skipped}, ล้มเหลว {failed}")
