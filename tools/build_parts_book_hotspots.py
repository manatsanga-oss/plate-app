# -*- coding: utf-8 -*-
"""
หาตำแหน่ง "หมายเลขลำดับ" บนรูป diagram ของคู่มือรายการอะไหล่ → เติม hotspots ลง JSON (ให้กดเลขบนรูปได้)

เลขบนรูปเป็น raster (ไม่มี text layer) และ OCR ทั่วไปอ่านตัวเลขเดี่ยว ๆ ไม่ได้ → ใช้วิธี "รู้จำด้วยแม่แบบ":
  1) หา connected components ขนาดเท่าตัวเลข (ตัวเลขไม่ติดเส้นรูป) ในทุกบล็อกของเล่ม
  2) normalize เป็น 16x24 แล้ว k-means จัดกลุ่มรูปร่าง → เขียน montage ให้คนดูแล้วติดป้ายกลุ่ม (0-9 / x=ไม่ใช่เลข)
  3) ใช้ป้ายกลุ่ม (ไฟล์ <slug>_glyph_labels.json) จำแนกทุก glyph → รวมตัวที่ติดกันเป็นเลข 2 หลัก
     → เก็บเฉพาะเลขที่มีใน "ลำดับ" ของตารางบล็อกนั้น → blocks[].hotspots = [{ref,x,y,w,h}] (% ของรูป)

ใช้งาน:
  python tools/build_parts_book_hotspots.py <slug> cluster        → สร้าง montage ให้ติดป้าย (public/../scratch)
  python tools/build_parts_book_hotspots.py <slug> apply          → ใช้ป้ายกลุ่มเติม hotspots ลง JSON
ป้ายกลุ่มเก็บที่ tools/glyph_labels/<slug>_glyph_labels.json  {"0": "1", "1": "x", ...}  (key = เลขกลุ่ม)
ฟอนต์ตัวเลขของ Honda เหมือนกันทุกเล่ม → ป้าย/ศูนย์กลางกลุ่มของเล่มแรกใช้ซ้ำกับเล่มอื่นได้ (apply จะ fallback ไปใช้ของ adv160)
"""
import sys, io, os, json
if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LBL_DIR = os.path.join(ROOT, "tools", "glyph_labels")
GW, GH = 16, 24   # ขนาด glyph หลัง normalize
K = 40            # จำนวนกลุ่ม k-means


def glyphs_of(img_path):
    """คืน (lab, comps) — comps = [(x0,y0,x1,y1,label_id)] ที่ขนาด/ความหนาเหมือนตัวเลข"""
    g = np.array(Image.open(img_path).convert("L"))
    H, W = g.shape
    dark = g < 110                              # ลายน้ำ HONDA เป็นเทาอ่อน → ตัดออก
    lab, n = ndimage.label(dark)
    objs = ndimage.find_objects(lab)
    comps = []
    for i, sl in enumerate(objs):
        if sl is None: continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        h, w = y1 - y0, x1 - x0
        if not (H * 0.017 <= h <= H * 0.033): continue     # สูง ~2-3% ของรูป
        if w > h * 1.05 or w < h * 0.15: continue          # แคบกว่าสูง (เลข 1 แคบมาก)
        fill = (lab[y0:y1, x0:x1] == i + 1).mean()
        if not (0.15 <= fill <= 0.75): continue
        comps.append((x0, y0, x1, y1, i + 1))
    return lab, comps, (W, H)


def vec_of(lab, c):
    x0, y0, x1, y1, lid = c
    m = (lab[y0:y1, x0:x1] == lid).astype(np.uint8) * 255
    im = Image.fromarray(m)
    # วางกลางกรอบสัดส่วนคงที่ (กันเลข 1 ถูกยืดจนเหมือน I)
    h, w = m.shape
    box = max(h, int(w * GH / GW))
    canvas = Image.new("L", (int(box * GW / GH), box), 0)
    canvas.paste(im, ((canvas.width - w) // 2, (box - h) // 2))
    return np.asarray(canvas.resize((GW, GH), Image.BILINEAR), dtype=np.float32).ravel() / 255.0


def collect(slug, data):
    items = []  # (block_code, comp, vec)
    for b in data["blocks"]:
        if not b.get("img"): continue
        lab, comps, size = glyphs_of(os.path.join(ROOT, "public", b["img"].lstrip("/")))
        for c in comps:
            items.append((b["code"], c, vec_of(lab, c), size))
    return items


def kmeans(X, k, iters=30, seed=0):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), k, replace=False)].copy()
    for _ in range(iters):
        d = ((X[:, None, :] - C[None, :, :]) ** 2).sum(-1)
        a = d.argmin(1)
        for j in range(k):
            if (a == j).any(): C[j] = X[a == j].mean(0)
    d = ((X[:, None, :] - C[None, :, :]) ** 2).sum(-1)
    return C, d.argmin(1)


def cmd_cluster(slug):
    data = json.load(open(os.path.join(ROOT, "src", "data", "partsbooks", f"{slug}_parts_book.json"), encoding="utf-8"))
    items = collect(slug, data)
    X = np.stack([it[2] for it in items])
    C, a = kmeans(X, K)
    os.makedirs(LBL_DIR, exist_ok=True)
    np.save(os.path.join(LBL_DIR, f"{slug}_centers.npy"), C)
    # montage: แถวละกลุ่ม = [เลขกลุ่ม | ศูนย์กลาง | ตัวอย่าง 8 ตัว] ขยาย 2 เท่า
    S, n_s = 2, 8
    cell_w, cell_h = GW * S + 4, GH * S + 4
    from PIL import ImageDraw
    sheet = Image.new("L", (cell_w * (n_s + 2), cell_h * K), 255)
    dr = ImageDraw.Draw(sheet)
    for j in range(K):
        idx = np.where(a == j)[0]
        dr.text((4, j * cell_h + 8), f"{j}:{len(idx)}", fill=0)
        tiles = [C[j]] + [X[i] for i in idx[:n_s]]
        for t, v in enumerate(tiles):
            im = Image.fromarray((255 - v.reshape(GH, GW) * 255).astype(np.uint8)).resize((GW * S, GH * S))
            sheet.paste(im, (cell_w * (t + 1) + 2, j * cell_h + 2))
    out = os.path.join(LBL_DIR, f"{slug}_clusters.png")
    sheet.save(out)
    print(f"glyphs {len(items)} · กลุ่ม {K} → {out}\nติดป้ายใน {os.path.join(LBL_DIR, slug + '_glyph_labels.json')} แล้วรัน apply")


def cmd_apply(slug):
    jp = os.path.join(ROOT, "src", "data", "partsbooks", f"{slug}_parts_book.json")
    data = json.load(open(jp, encoding="utf-8"))
    src = slug if os.path.exists(os.path.join(LBL_DIR, f"{slug}_glyph_labels.json")) else "adv160"
    C = np.load(os.path.join(LBL_DIR, f"{src}_centers.npy"))
    labels = json.load(open(os.path.join(LBL_DIR, f"{src}_glyph_labels.json"), encoding="utf-8"))
    total = 0
    for b in data["blocks"]:
        if not b.get("img"): continue
        refs = {str(p["ref"]) for p in b["parts"] if p.get("ref")}
        lab, comps, (W, H) = glyphs_of(os.path.join(ROOT, "public", b["img"].lstrip("/")))
        glyphs = []
        for c in comps:
            v = vec_of(lab, c)
            d = ((C - v) ** 2).sum(1)
            j = int(d.argmin())
            ch = labels.get(str(j), "x")
            glyphs.append({"box": c[:4], "ch": ch, "dist": float(d[j])})
        # รวมตัวที่ติดกันแนวนอนเป็น token
        glyphs.sort(key=lambda g: (g["box"][1], g["box"][0]))
        used = [False] * len(glyphs); tokens = []
        for i, g in enumerate(glyphs):
            if used[i]: continue
            cur = list(g["box"]); chars = [(g["box"][0], g["ch"])]; used[i] = True
            changed = True
            while changed:
                changed = False
                for j2, g2 in enumerate(glyphs):
                    if used[j2]: continue
                    bx = g2["box"]; h = max(cur[3] - cur[1], bx[3] - bx[1])
                    gap = max(bx[0] - cur[2], cur[0] - bx[2])
                    if gap < h * 0.9 and abs(bx[1] - cur[1]) < h * 0.3 and abs(bx[3] - cur[3]) < h * 0.3:  # 0.9h: ให้ "F-24" (ป้ายอ้างอิงบล็อกอื่น ตัวหนา) รวมเป็น token เดียวแล้วถูกตัดทิ้ง
                        cur = [min(cur[0], bx[0]), min(cur[1], bx[1]), max(cur[2], bx[2]), max(cur[3], bx[3])]
                        chars.append((bx[0], g2["ch"])); used[j2] = True; changed = True
            txt = "".join(ch for _, ch in sorted(chars))
            tokens.append((cur, txt))
        spots = []
        for (x0, y0, x1, y1), txt in tokens:
            if txt.isdigit() and txt in refs:
                spots.append({"ref": txt, "x": round(x0 / W * 100, 2), "y": round(y0 / H * 100, 2),
                              "w": round((x1 - x0) / W * 100, 2), "h": round((y1 - y0) / H * 100, 2)})
        b["hotspots"] = spots
        found = {s["ref"] for s in spots}
        total += len(spots)
        missing = sorted(refs - found, key=lambda x: int(x))
        print(f"{b['code']:8} จุด {len(spots):2} · ลำดับในตาราง {len(refs):2}" + (f" · ไม่เจอ: {missing}" if missing else " ✓"))
    json.dump(data, open(jp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✔ บันทึก {total} จุด → {jp}")


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[2] not in ("cluster", "apply"):
        print(__doc__); sys.exit(1)
    (cmd_cluster if sys.argv[2] == "cluster" else cmd_apply)(sys.argv[1])
