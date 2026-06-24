# -*- coding: utf-8 -*-
"""สร้าง yam_finn_color_parts.json จาก PDF สมุดภาพชุดสี YAMAHA FINN (B6F / T115FL)"""
import sys, os, re, json
sys.stdout.reconfigure(encoding="utf-8")
import pdfplumber
import pypdfium2 as pdfium

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLUG = "yam_finn"
IMG_DIR = os.path.join(ROOT, "public", "parts-img", SLUG)
PDF_DIR = os.path.join(ROOT, "public", "parts-pdf")
JSON_DIR = os.path.join(ROOT, "src", "data", "models")
SRC = r"C:\Users\manat\OneDrive\Desktop\สมุดรูปภาพชุดสี YAMAHA"
FILES = ["1YB6F431T1.pdf", "B6F5-6-7-820post.pdf", "B6FD-E-F-G20post.pdf", "B6FH-J-K-L20post.pdf"]

CODE_RE = re.compile(r"^[0-9A-Z]{3}-[A-Z0-9]{5}-[0-9A-Z]{2}(-[A-Z0-9]+)?$")
HEAD_RE = re.compile(r"รถสี\s*(.+?)\s*รหัสสี\s*:\s*([0-9A-Z]{3,4})\s*,\s*([A-Z0-9]+)\s+(B6F[0-9A-Z])")

os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)

colors, pages = [], {}
seen_keys = {}

for fn in FILES:
    path = os.path.join(SRC, fn)
    doc = pdfium.PdfDocument(path)
    with pdfplumber.open(path) as pdf:
        for i, pg in enumerate(pdf.pages):
            txt = pg.extract_text() or ""
            m = HEAD_RE.search(txt)
            if not m:
                continue  # ไม่ใช่หน้าสี (ปก/สเปก)
            name = re.sub(r"\bFINN\b", "", m.group(1)).strip()
            paint, grade, typ = m.group(2), m.group(3), m.group(4)
            W, H = pg.width, pg.height
            rows, seen = [], set()
            for w in pg.extract_words():
                t = w["text"]
                if "*" in t or t in seen or not CODE_RE.match(t):
                    continue
                seen.add(t)
                rows.append({
                    "code": t,
                    "x": round(w["x0"] / W * 100, 2),
                    "y": round(w["top"] / H * 100, 2),
                    "w": round((w["x1"] - w["x0"]) / W * 100, 2),
                    "h": round((w["bottom"] - w["top"]) / H * 100, 2),
                })
            if not rows:
                continue
            key = f"{typ.lower()}_{paint.lower()}"
            if key in seen_keys:
                seen_keys[key] += 1
                key = f"{key}_{seen_keys[key]}"
            else:
                seen_keys[key] = 0
            pages[key] = rows
            img = f"/parts-img/{SLUG}/{key}.jpg"
            colors.append({
                "code": paint, "name": name, "color_code": grade,
                "page": key, "pages": [key], "img": img, "imgs": [img],
                "model_code": "FINN", "type": typ,
            })
            pil = doc[i].render(scale=2.5).to_pil().convert("RGB")
            pil.save(os.path.join(IMG_DIR, f"{key}.jpg"), "JPEG", quality=82)
    # คัดลอก PDF ต้นฉบับ
    import shutil
    shutil.copy(path, os.path.join(PDF_DIR, fn))

data = {
    "file": ",".join(FILES),
    "brand": "YAMAHA",
    "model": "FINN",
    "model_code": "FINN",
    "series": "FINN",
    "title": "FINN สมุดรูปภาพชุดสี (Yamaha)",
    "pdf_url": f"/parts-pdf/{FILES[0]}",
    "colors": colors,
    "pages": pages,
}
out = os.path.join(JSON_DIR, f"{SLUG}_color_parts.json")
json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
total = sum(len(v) for v in pages.values())
print(f"OK {len(colors)} colors, {total} codes -> {out}")
# สรุปแยก type
from collections import Counter
c = Counter(x["type"] for x in colors)
print("types:", dict(c))
print("color names:", [f'{x["type"]}:{x["name"]}({x["code"]})' for x in colors])
