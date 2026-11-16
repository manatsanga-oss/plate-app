#!/usr/bin/env python3
# ดึงอิมเมจ Home Assistant เข้า Docker บน Pi โดยไม่ใช้ `docker pull` (2026-11-16)
# เหตุผล: Docker 20.10 (docker.io ของ Debian 12) แตกเลเยอร์ที่บีบอัดแบบ zstd ไม่ได้ → "failed to register layer: archive/tar: invalid tar header"
# วิธี: โหลด manifest + เลเยอร์จาก ghcr.io เอง → คลาย zstd/gzip ด้วยคำสั่งระบบ → ประกอบเป็น docker-archive → `docker load`
# ใช้: python3 ha_pull.py [tag]   (ค่าเริ่มต้น stable)  · อัปเดตรุ่นใหม่ = รันซ้ำ แล้วสร้าง container ใหม่ (ดู ha_run.sh)
import hashlib, json, os, shutil, subprocess, sys, urllib.request

REPO = "home-assistant/home-assistant"
TAG = sys.argv[1] if len(sys.argv) > 1 else "stable"
WORK = os.path.expanduser("~/ha_image_tmp")
ACCEPT = ", ".join(["application/vnd.oci.image.index.v1+json", "application/vnd.docker.distribution.manifest.list.v2+json",
                    "application/vnd.oci.image.manifest.v1+json", "application/vnd.docker.distribution.manifest.v2+json"])

def get(url, headers=None, out=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=120) as r:
        if out is None: return r.read()
        h = hashlib.sha256(); n = 0
        with open(out, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b: break
                f.write(b); h.update(b); n += len(b)
        return h.hexdigest(), n

tok = json.loads(get(f"https://ghcr.io/token?scope=repository:{REPO}:pull"))["token"]
H = {"Authorization": "Bearer " + tok, "Accept": ACCEPT}
idx = json.loads(get(f"https://ghcr.io/v2/{REPO}/manifests/{TAG}", H))
if "manifests" in idx:
    m = next(x for x in idx["manifests"] if x.get("platform", {}).get("architecture") == "arm64" and x.get("platform", {}).get("os") == "linux")
    man = json.loads(get(f"https://ghcr.io/v2/{REPO}/manifests/{m['digest']}", H))
else:
    man = idx
print("tag", TAG, "| layers", len(man["layers"]), "| compressed MB", round(sum(l["size"] for l in man["layers"]) / 1e6))

shutil.rmtree(WORK, ignore_errors=True); os.makedirs(WORK)
cfg_digest = man["config"]["digest"]
cfg = get(f"https://ghcr.io/v2/{REPO}/blobs/{cfg_digest}", H)
assert "sha256:" + hashlib.sha256(cfg).hexdigest() == cfg_digest, "config digest mismatch"
cfg_name = cfg_digest.split(":")[1] + ".json"
open(os.path.join(WORK, cfg_name), "wb").write(cfg)
diff_ids = json.loads(cfg)["rootfs"]["diff_ids"]
layers = []
for i, l in enumerate(man["layers"]):
    blob = os.path.join(WORK, f"blob{i}")
    dg, n = get(f"https://ghcr.io/v2/{REPO}/blobs/{l['digest']}", H, out=blob)
    assert "sha256:" + dg == l["digest"], f"layer {i} digest mismatch"
    d = os.path.join(WORK, str(i)); os.makedirs(d); tar = os.path.join(d, "layer.tar")
    mt = l.get("mediaType", "")
    if "zstd" in mt: subprocess.run(["zstd", "-d", "-q", "-f", blob, "-o", tar], check=True)
    elif "gzip" in mt:
        with open(tar, "wb") as f: subprocess.run(["gzip", "-dc", blob], stdout=f, check=True)
    else: shutil.move(blob, tar)
    if os.path.exists(blob): os.remove(blob)
    h = hashlib.sha256()
    with open(tar, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    assert "sha256:" + h.hexdigest() == diff_ids[i], f"layer {i} uncompressed digest mismatch"
    layers.append(f"{i}/layer.tar")
    print(f"  layer {i + 1}/{len(man['layers'])} ok  {round(n / 1e6)} MB  {mt.split('.')[-1]}", flush=True)
ref = f"ghcr.io/{REPO}:{TAG}"
json.dump([{"Config": cfg_name, "RepoTags": [ref], "Layers": layers}], open(os.path.join(WORK, "manifest.json"), "w"))
p1 = subprocess.Popen(["tar", "-C", WORK, "-cf", "-", "."], stdout=subprocess.PIPE)
r = subprocess.run(["docker", "load"], stdin=p1.stdout, capture_output=True, text=True)
p1.wait()
print(r.stdout.strip() or r.stderr.strip())
shutil.rmtree(WORK, ignore_errors=True)
sys.exit(r.returncode)
