# -*- coding: utf-8 -*-
"""merge สมุดภาพชุดสี Yamaha รุ่นใหม่ เข้า yam_nmax (GPD155) + yam_grandfilano (LTF125)"""
import sys, os, re, json, shutil
sys.stdout.reconfigure(encoding="utf-8")
import pdfplumber
import pypdfium2 as pdfium

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "public", "parts-pdf")
JSON_DIR = os.path.join(ROOT, "src", "data", "models")
SRC = r"C:\Users\manat\OneDrive\Desktop\สมุดรูปภาพชุดสี YAMAHA"

CODE_RE = re.compile(r"^[0-9A-Z]{3}-[A-Z0-9]{5}-[0-9A-Z]{2}(-[A-Z0-9]+)?$")
HEAD_RE = re.compile(r"รถสี\s*(.+?)\s*รหัสสี\s*:\s*([0-9A-Z]{3,4})\s*,\s*([A-Z0-9]+)\s+([0-9A-Z]{3,4})\s+(GPD155|LTF125)")
NAME_STRIP = re.compile(r"\s*(New\b.*|NMAX.*|GRAND.*|FINN.*)$")

# slug -> (model_code/แบบ เดิม, [ไฟล์...], {override สำหรับหน้า text พัง})
JOBS = {
    "yam_nmax": ("NMAX", [
        "B1T120post.pdf", "B1T320post.pdf", "B1T420BBB220post.pdf",
        "B1T520post.pdf", "BBB120post.pdf", "BBB5_for%20post.pdf",
    ]),
    "yam_grandfilano": ("Grand Filano", [
        "B8B6-720post.pdf", "B8B820B8B920post.pdf", "BJK1-220post.pdf",
    ]),
}
# หน้าที่ text layer พัง (BBB5) — page index 0-based -> (name, paint, grade, type)
BROKEN = {
    ("BBB5_for%20post.pdf", 2): ("เขียว", "1847", "MDBNM4", "BBB5"),
    ("BBB5_for%20post.pdf", 3): ("เทา", "1786", "WMB", "BBB5"),
    ("BBB5_for%20post.pdf", 4): ("แดง", "1725", "RSH", "BBB5"),
}


def codes_of(pg):
    W, H = pg.width, pg.height
    rows, seen = [], set()
    for w in pg.extract_words():
        t = w["text"]
        if "*" in t or t in seen or not CODE_RE.match(t):
            continue
        seen.add(t)
        rows.append({
            "code": t,
            "x": round(w["x0"] / W * 100, 2), "y": round(w["top"] / H * 100, 2),
            "w": round((w["x1"] - w["x0"]) / W * 100, 2), "h": round((w["bottom"] - w["top"]) / H * 100, 2),
        })
    return rows


for slug, (baeb, files) in JOBS.items():
    jpath = os.path.join(JSON_DIR, f"{slug}_color_parts.json")
    data = json.load(open(jpath, encoding="utf-8"))
    img_dir = os.path.join(ROOT, "public", "parts-img", slug)
    os.makedirs(img_dir, exist_ok=True)
    existing_keys = set(data["pages"].keys())
    added = 0
    for fn in files:
        path = os.path.join(SRC, fn)
        doc = pdfium.PdfDocument(path)
        with pdfplumber.open(path) as pdf:
            for i, pg in enumerate(pdf.pages):
                if (fn, i) in BROKEN:
                    name, paint, grade, typ = BROKEN[(fn, i)]
                else:
                    m = HEAD_RE.search(pg.extract_text() or "")
                    if not m:
                        continue
                    name = NAME_STRIP.sub("", m.group(1)).strip()
                    paint, grade, typ = m.group(2), m.group(3), m.group(4)
                rows = codes_of(pg)
                if not rows:
                    continue
                key = f"{typ.lower()}_{paint.lower()}"
                n = 0
                while key in existing_keys:
                    n += 1; key = f"{typ.lower()}_{paint.lower()}_{n}"
                existing_keys.add(key)
                data["pages"][key] = rows
                img = f"/parts-img/{slug}/{key}.jpg"
                data["colors"].append({
                    "code": paint, "name": name, "color_code": grade,
                    "page": key, "pages": [key], "img": img, "imgs": [img],
                    "model_code": baeb, "type": typ,
                })
                doc[i].render(scale=2.5).to_pil().convert("RGB").save(os.path.join(img_dir, f"{key}.jpg"), "JPEG", quality=82)
                added += 1
        shutil.copy(path, os.path.join(PDF_DIR, fn))
    # อัปเดต file list
    cur = set((data.get("file") or "").split(","))
    cur.update(files)
    data["file"] = ",".join(sorted(x for x in cur if x))
    json.dump(data, open(jpath, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    from collections import Counter
    print(f"{slug}: +{added} colors -> total {len(data['colors'])} | types {dict(Counter(c['type'] for c in data['colors']))}")
