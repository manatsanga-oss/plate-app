# -*- coding: utf-8 -*-
"""merge finn-b6fstuv.pdf (FINN 2024, B6FS/T/U/V) เข้า yam_finn เดิม"""
import sys, os, re, json, shutil
sys.stdout.reconfigure(encoding="utf-8")
import pdfplumber, pypdfium2 as pdfium

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"C:\Users\manat\OneDrive\Desktop\สมุดรูปภาพชุดสี YAMAHA"
FN = "finn-b6fstuv.pdf"
slug = "yam_finn"

CODE_RE = re.compile(r"^[0-9A-Z]{3}-[A-Z0-9]{5}-[0-9A-Z]{2}(-[A-Z0-9]+)?$")
HEAD_RE = re.compile(r"รถสี\s*(.+?)\s*รหัสสี\s*:\s*([0-9A-Z]{3,4})\s*,\s*([A-Z0-9]+)\s+(B6F[0-9A-Z])\s+T115FL")
NAME_STRIP = re.compile(r"\s*(FINN.*)$")
BROKEN = {5: ("ดำ", "0903", "SMX", "B6FT")}  # p6 (0-based 5) text พัง

jpath = os.path.join(ROOT, "src", "data", "models", f"{slug}_color_parts.json")
data = json.load(open(jpath, encoding="utf-8"))
img_dir = os.path.join(ROOT, "public", "parts-img", slug)
keys = set(data["pages"].keys())

path = os.path.join(SRC, FN)
doc = pdfium.PdfDocument(path)
added = 0
with pdfplumber.open(path) as pdf:
    for i, pg in enumerate(pdf.pages):
        if i in BROKEN:
            name, paint, grade, typ = BROKEN[i]
        else:
            m = HEAD_RE.search(pg.extract_text() or "")
            if not m:
                continue
            name = NAME_STRIP.sub("", m.group(1)).strip()
            paint, grade, typ = m.group(2), m.group(3), m.group(4)
        W, H = pg.width, pg.height
        rows, seen = [], set()
        for w in pg.extract_words():
            t = w["text"]
            if "*" in t or t in seen or not CODE_RE.match(t):
                continue
            seen.add(t)
            rows.append({"code": t, "x": round(w["x0"]/W*100, 2), "y": round(w["top"]/H*100, 2),
                         "w": round((w["x1"]-w["x0"])/W*100, 2), "h": round((w["bottom"]-w["top"])/H*100, 2)})
        if not rows:
            continue
        key = f"{typ.lower()}_{paint.lower()}"; n = 0
        while key in keys:
            n += 1; key = f"{typ.lower()}_{paint.lower()}_{n}"
        keys.add(key)
        data["pages"][key] = rows
        img = f"/parts-img/{slug}/{key}.jpg"
        data["colors"].append({"code": paint, "name": name, "color_code": grade, "page": key,
                               "pages": [key], "img": img, "imgs": [img], "model_code": "FINN", "type": typ})
        doc[i].render(scale=2.5).to_pil().convert("RGB").save(os.path.join(img_dir, f"{key}.jpg"), "JPEG", quality=82)
        added += 1
shutil.copy(path, os.path.join(ROOT, "public", "parts-pdf", FN))
cur = set((data.get("file") or "").split(",")); cur.add(FN)
data["file"] = ",".join(sorted(x for x in cur if x))
json.dump(data, open(jpath, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
from collections import Counter
print(f"yam_finn: +{added} -> total {len(data['colors'])} | types {dict(Counter(c['type'] for c in data['colors']))}")
