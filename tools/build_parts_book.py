# -*- coding: utf-8 -*-
"""
สกัด "คู่มือรายการอะไหล่" Honda (PL-*.PDF) → สมุดภาพอะไหล่รายบล็อก (E-1..F-34) สำหรับหน้า "ค้นรูปอะไหล่"

ผลลัพธ์:
  src/data/partsbooks/<slug>_parts_book.json   (บล็อก + ตารางอะไหล่ + จำนวนต่อแบบ + หมายเหตุ type)
  public/parts-book/<slug>/<block>.jpg          (รูป diagram ของแต่ละบล็อก WebP กว้าง 2000px)

ใช้งาน:  python tools/build_parts_book.py "<path PDF>" <slug> <MODEL> [BRAND]
ตัวอย่าง: python tools/build_parts_book.py "C:/.../PL-ADV160-02_26.PDF" adv160 ADV160

หมายเหตุโครงสร้าง PDF (เล่มปี 2026):
  - หน้าบล็อก = รูป diagram (PNG ฝัง 6300x3150) + ตารางด้านล่าง: ลำดับ | หมายเลขอะไหล่ | ชื่อไทย.... | จำนวน P S T | ชื่ออังกฤษ | หมายเลขเครื่อง/รุ่นที่ใช้
  - คอลัมน์เลื่อนตามหน้าคู่/คี่ → อิงตำแหน่ง x ของหัวตารางในแต่ละหน้า
  - แถวต่อเนื่อง (ไม่มีลำดับ) = รหัสทางเลือกของลำดับเดิม (ต่างแบบ/สี) → สืบทอดลำดับ + ชื่อฐานจากแถวก่อน
  - ฟอนต์ไทยเพี้ยน: สระ/วรรณยุกต์ซ้ำ (สููบ), อักษรขยะนอกช่วงไทย/ASCII → clean()
"""
import sys, io, os, re, json

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import fitz  # PyMuPDF
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_WIDTH = 2000
IMG_Q = 80  # WebP (เล็กกว่า JPEG ~40% สำหรับลายเส้น)

CODE_RE = re.compile(r"^\d{5}-[A-Z0-9]{2,5}-[A-Z0-9]{2,6}$")  # กลาง 5 ตัว = โบลต์/น็อตมาตรฐาน เช่น 95701-06018-00
QTY_RE = re.compile(r"^\(?(\d+|-)\)?$")  # "(1)" = อะไหล่ทางเลือก/โอเวอร์ไซส์
ENGINE_RE = re.compile(r"^(-{3,}|[A-Z]?\d{6,}~?|[A-Z0-9]{3,6}-\d{6,}~?)$")
BLOCK_RE = re.compile(r"^([A-Z])\s*-\s*(\d+)(?:\s*-\s*(\d+))?$")
TYPE_RE = re.compile(r"^\d?TH$")
COMB = "ัิีึืุู็่้๊๋์ำ"


def clean(s):
    # เก็บเฉพาะอักษรไทย + ASCII (ฟอนต์ Honda แทรกอักษรขยะ ĕ ħ Ĩ Ĭ ő ł � zero-width ฯลฯ)
    s = "".join(ch for ch in s if "฀" <= ch <= "๿" or " " <= ch <= "~" or ch in "\n\t")
    # ฟอนต์ Honda ซ้ำสระ/วรรณยุกต์ (สููบ → สูบ, ทั้้ง → ทั้ง)
    s = re.sub(r"([" + COMB + r"])\1+", r"\1", s)
    s = re.sub(r"\.{2,}", "", s)  # จุดไข่ปลาท้ายชื่อ
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()


def has_thai(s):
    return any("\u0e00" <= ch <= "\u0e7f" for ch in s)


def group_lines(words, tol=2.5):
    """จับคำเป็นบรรทัดตาม y กลาง"""
    lines = []
    for w in sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        yc = (w[1] + w[3]) / 2
        if lines and abs(lines[-1][0] - yc) <= tol:
            lines[-1][1].append(w)
        else:
            lines.append([yc, [w]])
    return [(y, sorted(ws, key=lambda w: w[0])) for y, ws in lines]


def parse_variants(doc, base):
    """หน้าตาราง รุ่น/รหัสพื้นที่/หมายเลขเครื่อง → [{model_code, types[]}]"""
    for i in range(min(30, len(doc))):
        t = doc[i].get_text()
        if "หมายเลขเครื่องยนต์" not in clean(t) or base not in t:
            continue
        toks = [x.strip() for x in re.split(r"[\t\n]+", t) if x.strip()]
        out, cur = [], None
        for tok in toks:
            if tok.startswith(base) and re.fullmatch(r"[A-Z0-9]+", tok):
                cur = {"model_code": tok, "types": []}
                out.append(cur)
            elif cur and TYPE_RE.match(tok):
                cur["types"].append(tok)
        if out:
            return out
    return []


def parse_block_page(page):
    """คืน (block_code, name_th, name_en, parts[]) หรือ None ถ้าไม่ใช่หน้าบล็อก"""
    words = page.get_text("words")
    H = page.rect.height
    top = [w for w in words if w[1] < 45]
    # รหัสบล็อก = คำละตินซ้ายสุดบนหัวกระดาษ เช่น "E - 1", "F - 2 - 1" · ชื่อบล็อก = คำที่เหลือ (ไทย/อังกฤษ)
    code_txt = " ".join(w[4] for w in sorted(top, key=lambda w: w[0]) if w[0] < 200 and not has_thai(w[4]))
    m = BLOCK_RE.match(code_txt.strip())
    if not m:
        return None
    block = f"{m.group(1)}-{m.group(2)}" + (f"-{m.group(3)}" if m.group(3) else "")
    title = [w for w in sorted(top, key=lambda w: w[0]) if w[0] >= 200]
    name_th = clean(" ".join(w[4] for w in title if has_thai(w[4])))
    name_en = clean(" ".join(w[4] for w in title if not has_thai(w[4]) and re.search(r"[A-Za-z]", w[4])))

    # หัวตาราง
    hdr = {}
    for w in words:
        c = clean(w[4])
        if c == "ลำดับ": hdr["ref"] = w
        elif c == "หมายเลขอะไหล่": hdr["code"] = w
        elif c == "ชื่ออะไหล่": hdr["name"] = w
        elif c == "หมายเลขเครื่องที่ใช้": hdr["note"] = w
        elif c == "รุ่นที่ใช้": hdr["type"] = w
    if "code" not in hdr or "note" not in hdr:
        return (block, name_th, name_en, [])
    y_hdr = hdr["code"][1]
    pst = [w for w in words if w[4] in ("P", "S", "T", "U", "V") and y_hdr < w[1] < y_hdr + 25 and w[0] > hdr["name"][0] + 100]
    pst.sort(key=lambda w: w[0])
    cols = [(w[4], (w[0] + w[2]) / 2) for w in pst]
    x_code = hdr["code"][0] - 3
    x_qty0 = (cols[0][1] - 10) if cols else hdr["note"][0] - 120
    x_note = hdr["note"][0] - 6
    x_type = hdr["type"][0] - 6 if "type" in hdr else x_note + 70  # คอลัมน์ type (TH/3TH) · ชื่ออังกฤษยาวล้ำเข้าเขต "หมายเลขเครื่อง" ได้
    y_start = (pst[0][3] if pst else hdr["code"][3]) + 1

    body = [w for w in words if w[1] > y_start and w[3] < H - 35 and w[0] > hdr["ref"][0] - 15 if "ref" in hdr]
    parts = []
    last = None
    for y, ws in group_lines(body):
        code_w = next((w for w in ws if CODE_RE.match(w[4]) and abs(w[0] - x_code) < 12), None)
        ref_ws = [w for w in ws if w[2] < x_code + 2 and re.fullmatch(r"\d{1,3}", w[4])]
        th_ws = [w for w in ws if x_code + 50 < w[0] < x_qty0 and not CODE_RE.match(w[4])]
        qty_ws = [w for w in ws if x_qty0 <= w[0] < (cols[-1][1] + 10 if cols else x_note) and QTY_RE.match(w[4])]
        is_note = lambda w: w[0] >= x_type or (w[0] >= x_note and ENGINE_RE.match(w[4]))
        en_ws = [w for w in ws if (cols[-1][1] + 10 if cols else x_qty0) <= w[0] and not is_note(w) and w not in qty_ws]
        note_ws = [w for w in ws if is_note(w)]
        if code_w is None:
            # บรรทัดชื่อล้น (ไม่มีรหัส/จำนวน) → ต่อท้ายชื่อของแถวก่อน
            if last and not qty_ws and (th_ws or en_ws) and not ref_ws:
                if th_ws: last["name_th"] = clean(last["name_th"] + " " + " ".join(w[4] for w in th_ws))
                if en_ws: last["name_en"] = clean(last["name_en"] + " " + " ".join(w[4] for w in en_ws))
                if note_ws: last["note"] = clean((last["note"] + " " + " ".join(w[4] for w in note_ws)).strip())
            continue
        qty = {}
        for w in qty_ws:
            xc = (w[0] + w[2]) / 2
            col = min(cols, key=lambda c: abs(c[1] - xc))[0] if cols else "?"
            qty[col] = w[4]
        row = {
            "ref": ref_ws[0][4] if ref_ws else (last["ref"] if last else ""),
            "code": code_w[4],
            "name_th": clean(" ".join(w[4] for w in th_ws)),
            "name_en": clean(" ".join(w[4] for w in en_ws)),
            "qty": qty,
            "note": clean(" ".join(w[4] for w in note_ws)),
        }
        if not ref_ws and last:
            row["alt"] = True  # รหัสทางเลือกของลำดับเดิม
            # แถวสี/แบบ ที่มีแค่ "รถสีแดง-ดำ" → เติมชื่อฐานจากแถวหลัก
            base_th = re.split(r"\s*รถ(?:ทุกสี|สี)", last["name_th"])[0].strip()
            if re.match(r"^รถ(ทุกสี|สี)", row["name_th"]) and base_th:
                row["name_th"] = clean(base_th + " " + row["name_th"])
            base_en = last["name_en"].split("*")[0].strip()
            if row["name_en"].startswith("*") and base_en:
                row["name_en"] = clean(base_en + " " + row["name_en"])
        parts.append(row)
        last = row
    return (block, name_th, name_en, parts)


def save_block_image(doc, page, out_path):
    imgs = page.get_images(full=True)
    if not imgs:
        return False
    # เลือกรูปใหญ่สุดบนหน้า = diagram
    best = max(imgs, key=lambda im: im[2] * im[3])
    info = doc.extract_image(best[0])
    im = Image.open(io.BytesIO(info["image"]))
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    if im.width > IMG_WIDTH:
        im = im.resize((IMG_WIDTH, round(im.height * IMG_WIDTH / im.width)), Image.LANCZOS)
    im.save(out_path, "WEBP", quality=IMG_Q, method=6)
    return True


def build(pdf_path, slug, model, brand="HONDA"):
    doc = fitz.open(pdf_path)
    img_dir = os.path.join(ROOT, "public", "parts-book", slug)
    os.makedirs(img_dir, exist_ok=True)
    json_dir = os.path.join(ROOT, "src", "data", "partsbooks")
    os.makedirs(json_dir, exist_ok=True)

    # base code เช่น ADV160A จากหัวคอลัมน์จำนวน (บรรทัดถัดจาก "จำนวนที่ใช้")
    base = None
    for i in range(len(doc)):
        t = clean(doc[i].get_text())
        m = re.search(r"จำนวนที่ใช้\s+([A-Z]+\d+[A-Z]*)\s+[PSTUV](?:\s+[PSTUV])+", t)
        if m:
            base = m.group(1); break
    variants = parse_variants(doc, base or model)
    # ผูก col letter (P/S/T) กับ model_code = base + letter
    for v in variants:
        v["col"] = v["model_code"][len(base):] if base and v["model_code"].startswith(base) else v["model_code"][-1]

    # วันที่พิมพ์ (หน้าคำแนะนำ)
    edition = ""
    for i in range(min(15, len(doc))):
        m = re.search(r"ตีพิมพ์เมื่อ\s*([0-9]{1,2}\s+\S+\s+\d{4})", clean(doc[i].get_text()))
        if m: edition = m.group(1); break

    blocks, order = {}, []
    for i in range(len(doc)):
        page = doc[i]
        r = parse_block_page(page)
        if not r:
            continue
        code, nth, nen, parts = r
        if code not in blocks:
            blocks[code] = {"code": code, "name_th": nth, "name_en": nen, "page": i + 1, "img": None, "parts": []}
            order.append(code)
        b = blocks[code]
        if b["img"] is None:
            fn = f"{code}.webp"
            fp = os.path.join(img_dir, fn)
            # รูปที่มีอยู่แล้วไม่ต้องสร้างซ้ำ (ย่อรูปช้า ~5 วิ/บล็อก) — ลบไฟล์รูปทิ้งถ้าต้องการสร้างใหม่
            if os.path.exists(fp) or save_block_image(doc, page, fp):
                b["img"] = f"/parts-book/{slug}/{fn}"
        seen = {(p["code"], p["ref"]) for p in b["parts"]}
        for p in parts:
            if not p["ref"] and b["parts"]:  # หน้าต่อเนื่อง: แถวแรกไม่มีลำดับ → สืบทอดจากแถวท้ายของหน้าก่อน
                p["ref"] = b["parts"][-1]["ref"]; p["alt"] = True
            if (p["code"], p["ref"]) not in seen:
                b["parts"].append(p); seen.add((p["code"], p["ref"]))

    sections = []
    for code in order:
        s = code.split("-")[0]
        if s not in [x["key"] for x in sections]:
            sections.append({"key": s, "name": {"E": "หมวดเครื่องยนต์", "F": "หมวดตัวถัง"}.get(s, f"หมวด {s}")})

    out = {
        "brand": brand, "model": model, "base": base, "slug": slug,
        "file": os.path.basename(pdf_path), "edition": edition,
        "variants": variants, "sections": sections,
        "blocks": [blocks[c] for c in order],
    }
    jp = os.path.join(json_dir, f"{slug}_parts_book.json")
    with open(jp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    n_parts = sum(len(b["parts"]) for b in out["blocks"])
    n_codes = len({p["code"] for b in out["blocks"] for p in b["parts"]})
    no_img = [b["code"] for b in out["blocks"] if not b["img"]]
    empty = [b["code"] for b in out["blocks"] if not b["parts"]]
    print(f"✔ {model} ({slug}) บล็อก {len(out['blocks'])} · แถว {n_parts} · รหัสไม่ซ้ำ {n_codes}")
    print(f"  variants: {variants}")
    print(f"  JSON → {jp}")
    print(f"  รูป → {img_dir}")
    if no_img: print(f"  ⚠ บล็อกไม่มีรูป: {no_img}")
    if empty: print(f"  ⚠ บล็อกไม่มีรายการ: {empty}")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "HONDA")
