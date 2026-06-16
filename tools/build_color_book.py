# -*- coding: utf-8 -*-
"""
สร้างข้อมูล "สมุดรูปภาพชุดสี" จากไฟล์ PDF อัตโนมัติ (ใช้คู่กับ build_color_book.bat)

ทำให้อัตโนมัติ:
  - เรนเดอร์รูปรายสีทุกหน้า  -> public/parts-img/<slug>/page{N}.jpg
  - คัดลอก PDF ต้นฉบับ        -> public/parts-pdf/<ไฟล์เดิม>
  - ดึงรหัสอะไหล่ + พิกัด ทุกจุด ทุกหน้า
  - สร้างไฟล์ JSON skeleton   -> src/data/models/<slug>_color_parts.json
    (ฟิลด์ชื่อรุ่น/ชื่อสี/ชื่ออะไหล่ เว้นว่างไว้ เพราะฟอนต์ใน PDF เสีย ดึงเป็นตัวอักษรไม่ได้)

ขั้นตอนเดียวที่ต้องให้คน/AI ทำต่อ: เติม "ชื่อรุ่น, ชื่อสี, ชื่ออะไหล่" ในไฟล์ JSON
(หน้าเว็บใช้งานได้ทันทีแม้ชื่อยังว่าง — รูป+จุดกด+โครงสร้างครบ)

ใช้งาน:
  python tools/build_color_book.py "<path PDF>" [slug]
  หรือลากไฟล์ PDF วางบน tools/build_color_book.bat
"""
import sys, os, re, json, shutil

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")

import pdfplumber
import pypdfium2 as pdfium

# ── โฟลเดอร์ปลายทาง (อิงตำแหน่ง repo จาก path ของสคริปต์นี้) ──
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "public", "parts-img")
PDF_DIR = os.path.join(ROOT, "public", "parts-pdf")
JSON_DIR = os.path.join(ROOT, "src", "data", "models")

CODE_RE = re.compile(r"^\d{5}-[A-Z0-9]{2,4}-[A-Z0-9]{2,6}$")
RENDER_SCALE = 2.5


def slug_from_filename(path):
    """SB-ADV160-ADV160A_T_3TH_7TH.PDF -> adv160 ; SB-GIORNO-... -> giorno"""
    base = os.path.splitext(os.path.basename(path))[0]
    base = re.sub(r"^SB[-_]", "", base, flags=re.I)
    token = re.split(r"[-_]", base)[0]
    s = re.sub(r"[^A-Za-z0-9]", "", token).lower()
    return s or "model"


def main():
    if len(sys.argv) < 2:
        print("❌ ต้องระบุไฟล์ PDF:  python tools/build_color_book.py \"<path PDF>\" [slug]")
        return 1
    pdf_path = sys.argv[1].strip('"')
    if not os.path.isfile(pdf_path):
        print(f"❌ ไม่พบไฟล์: {pdf_path}")
        return 1
    slug = (sys.argv[2].strip() if len(sys.argv) > 2 else slug_from_filename(pdf_path))

    os.makedirs(os.path.join(IMG_DIR, slug), exist_ok=True)
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(JSON_DIR, exist_ok=True)

    print(f"📖 PDF: {os.path.basename(pdf_path)}  ->  slug: {slug}")

    # 1) หาหน้าที่มีรหัส (= หน้าสี) ด้วย pdfplumber + ดึงพิกัด
    pages = {}
    colors = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, pg in enumerate(pdf.pages):
            W, H = pg.width, pg.height
            rows, seen = [], set()
            for w in pg.extract_words():
                t = w["text"]
                if CODE_RE.match(t) and t not in seen:
                    seen.add(t)
                    rows.append({
                        "code": t,
                        "x": round(w["x0"] / W * 100, 2),
                        "y": round(w["top"] / H * 100, 2),
                        "w": round((w["x1"] - w["x0"]) / W * 100, 2),
                        "h": round((w["bottom"] - w["top"]) / H * 100, 2),
                    })
            if rows:  # หน้าสี
                pnum = i + 1
                pages[str(pnum)] = rows
                colors.append({
                    "page": pnum,
                    "code": "",          # รหัสสี เช่น BUB/GBR — เติมทีหลัง
                    "name": "",          # ชื่อสีไทย เช่น น้ำเงิน-ดำ — เติมทีหลัง
                    "color_code": "",    # เช่น PB-413P — เติมทีหลัง
                    "img": f"/parts-img/{slug}/page{pnum}.jpg",
                })

    if not colors:
        print("❌ ไม่พบหน้าที่มีรหัสอะไหล่ — ตรวจสอบว่าเป็น PDF สมุดภาพที่ถูกต้อง")
        return 1

    # 2) เรนเดอร์เฉพาะหน้าสี เป็น JPG
    doc = pdfium.PdfDocument(pdf_path)
    for c in colors:
        idx = c["page"] - 1
        pil = doc[idx].render(scale=RENDER_SCALE).to_pil().convert("RGB")
        out = os.path.join(IMG_DIR, slug, f"page{c['page']}.jpg")
        pil.save(out, "JPEG", quality=82)
    print(f"🖼️  เรนเดอร์รูป {len(colors)} สี -> public/parts-img/{slug}/")

    # 3) คัดลอก PDF
    pdf_name = os.path.basename(pdf_path)
    shutil.copy(pdf_path, os.path.join(PDF_DIR, pdf_name))

    # 4) เขียน JSON skeleton (กันทับของเดิมที่เติมชื่อแล้ว)
    json_path = os.path.join(JSON_DIR, f"{slug}_color_parts.json")
    if os.path.exists(json_path):
        json_path = os.path.join(JSON_DIR, f"{slug}_color_parts.NEW.json")
        print(f"⚠️  มีไฟล์ {slug}_color_parts.json อยู่แล้ว — เขียนเป็น .NEW.json แทน (กันทับชื่อที่เติมไว้)")

    data = {
        "file": pdf_name,
        "model": slug.upper(),     # เติม/แก้ชื่อจริงทีหลัง
        "model_code": "",
        "title": f"{slug.upper()} สมุดรูปภาพชุดสี",
        "pdf_url": f"/parts-pdf/{pdf_name}",
        "colors": colors,
        "pages": pages,
        "_todo": "เติม model, model_code, colors[].code/name/color_code (ชื่อรุ่น+สี อ่านจากหัวรูป) — รหัสอะไหล่ไม่ต้องมีชื่อ",
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in pages.values())
    print(f"📄 JSON: {os.path.relpath(json_path, ROOT)}  ({len(colors)} สี, {total} รหัสรวม)")
    print()
    print("✅ เสร็จส่วนอัตโนมัติแล้ว — หน้าเว็บจะเห็นรุ่นนี้ทันที (รูป+จุดกด+รหัสครบ)")
    print("➡️  เหลือเติม ชื่อรุ่น + ชื่อสี (อ่านจากหัวรูป): บอก Claude ว่า \"เติมชื่อรุ่น+สี " + slug + "\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
