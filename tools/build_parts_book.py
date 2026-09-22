# -*- coding: utf-8 -*-
"""
สกัด "คู่มือรายการอะไหล่" Honda (PL-*.PDF) → สมุดภาพอะไหล่รายบล็อก (E-1..F-34) สำหรับหน้า "ค้นรูปอะไหล่"

ผลลัพธ์:
  src/data/partsbooks/<slug>_parts_book.json   (บล็อก + ตารางอะไหล่ + จำนวนต่อแบบ + หมายเหตุ type)
  public/parts-book/<slug>/<block>.jpg          (รูป diagram ของแต่ละบล็อก WebP กว้าง 2000px)

ใช้งาน:  python tools/build_parts_book.py "<path PDF>" <slug> <MODEL[|MODEL2..]> [BRAND]
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

CODE_RE = re.compile(r"^\d{5}-[A-Z0-9]{2,5}(-[A-Z0-9]{2,6})?$")  # กลาง 5 ตัว = โบลต์มาตรฐาน 95701-06018-00 · 2 ท่อน = สกรู 93903-35320
QTY_RE = re.compile(r"^\(?(\d+|-)\)?$")  # "(1)" = อะไหล่ทางเลือก/โอเวอร์ไซส์
ENGINE_RE = re.compile(r"^(-{3,}|[A-Z]?\d{6,}~?|[A-Z0-9]{3,6}-\d{6,}~?)$")
BLOCK_RE = re.compile(r"^([A-Z])\s*-\s*(\d+)(?:\s*-\s*(\d+))?$")
TYPE_RE = re.compile(r"^\d?TH$")
COMB = "ัิีึืุู็่้๊๋์ำ"


# ไบต์ 0x80-0x9F ของฟอนต์ไทยแมคเก่า = สระบน/วรรณยุกต์ตำแหน่งพิเศษ (เทียบจากบริบทคำในเล่ม SONIC KGHJ)
LEGACY_HI = {0x83: "่", 0x84: "้", 0x85: "๊", 0x86: "๋", 0x87: "์", 0x88: "่", 0x89: "้",
             0x8A: "็", 0x8B: "๋", 0x8C: "์", 0x8D: "ํ", 0x92: "ั", 0x93: "็", 0x94: "ิ",
             0x95: "ี", 0x96: "ึ", 0x97: "ื", 0x98: "่", 0x99: "้", 0x9A: "๊", 0x9B: "๋", 0x9C: "์"}


def fix_legacy(s):
    """เล่มเก่า (SONIC KGHJ, PCX KWNA, WAVE125S ฯลฯ) เก็บไทยเป็นไบต์ TIS-620 แต่ text layer ถอดออกมาเป็นสัญลักษณ์ Mac Roman
    (เช่น "‡«≈“„π°“√" = "เวลาในการ") → แปลงกลับ: ตัวอักษร → ไบต์ mac_roman → ถอดเป็น TIS-620 (+ตาราง 0x80-0x9F)"""
    if not s or re.search(r"[ก-๛]", s):   # มีไทยจริงอยู่แล้ว ไม่ต้องแปลง
        return s
    s = s.replace("Ω", "Ω")   # OHM SIGN → OMEGA (0xBD = ฝ) · ห้ามใช้ NFKC เพราะจะแปลง ™(ช) ª(ป) µ(ต) เป็นละติน
    out = []
    for ch in s:
        if ord(ch) < 128:
            out.append(ch); continue
        try:
            b = ch.encode("mac_roman")[0]
        except Exception:
            out.append(ch); continue
        if b in LEGACY_HI: out.append(LEGACY_HI[b])
        elif 0xA1 <= b <= 0xFB: out.append(bytes([b]).decode("tis-620", "ignore"))   # 0xDB-0xDE/0xFC-0xFF ไม่มีใน TIS-620 → ทิ้ง
        else: out.append(ch)
    return "".join(out)


def clean(s):
    s = fix_legacy(s)
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
        t = fix_legacy(doc[i].get_text())
        if "หมายเลขเครื่องยนต์" not in clean(t) or base not in t:
            continue
        toks = [x.strip() for x in re.split(r"[\t\n]+", t) if x.strip()]
        out, cur = [], None
        for tok in toks:
            if tok.startswith(base[:5]) and tok != base and re.fullmatch(r"[A-Z]{2,}\d+[A-Z0-9]*", tok):   # รองรับ CL300A3S / FS1254 (ตัวเลขท้ายรหัส)
                cur = {"model_code": tok, "types": []}
                out.append(cur)
            elif cur and TYPE_RE.match(tok):
                cur["types"].append(tok)
        if out:
            # รวมรหัสซ้ำ (บางเล่มตารางรุ่นมี 2 ส่วน เช่น K36S/K97F) เก็บลำดับแรก + รวม type
            merged = []
            for v in out:
                hit = next((m for m in merged if m["model_code"] == v["model_code"]), None)
                if hit:
                    for t in v["types"]:
                        if t not in hit["types"]: hit["types"].append(t)
                else:
                    merged.append(v)
            return merged
    return []


def page_words(page):
    """คำพร้อมกล่อง เหมือน get_text("words") แต่ตัดคำเฉพาะช่องว่างธรรมดา — เล่มฟอนต์แมคเก่าเก็บ "ส" เป็น NBSP (0xCA)
    ซึ่ง get_text("words") ใช้เป็นตัวแบ่งคำจนตัว ส หาย → สร้างคำจาก rawdict เอง"""
    fast = page.get_text("words")
    if not any(" " in w[4] for w in fast) and " " not in page.get_text():   # เล่มปกติ → ใช้ words ปกติ (เร็ว)
        return fast
    out = []
    for b in page.get_text("rawdict")["blocks"]:
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                cur = []; box = None
                def flush():
                    if cur and box: out.append((box[0], box[1], box[2], box[3], "".join(cur)))
                for c in sp["chars"]:
                    ch = c["c"]
                    if ch.isspace() and ch != " ":   # แยกคำที่ช่องว่าง/แท็บ แต่ไม่แยกที่ NBSP (= ส)
                        flush(); cur = []; box = None; continue
                    cur.append(ch); bb = c["bbox"]
                    box = list(bb) if box is None else [min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3])]
                flush()
    return out


def parse_block_page(page, col_keys=None):
    """คืน (block_code, name_th, name_en, parts[]) หรือ None ถ้าไม่ใช่หน้าบล็อก"""
    words = page_words(page)
    if page.rotation:   # เล่มเก่า (SONIC KGHJ ฯลฯ) หน้าถูกหมุน 90° ในไฟล์ → แปลงพิกัดคำให้เป็นแนวที่เห็นจริง
        M = page.rotation_matrix; rw = []
        for w in words:
            r = fitz.Rect(w[:4]) * M; r.normalize(); rw.append((r.x0, r.y0, r.x1, r.y1) + tuple(w[4:]))
        words = rw
    words = [(w[0], w[1], w[2], w[3], fix_legacy(w[4])) + tuple(w[5:]) for w in words]   # ถอดรหัสไทยฟอนต์แมคเก่า
    H = page.rect.height
    top = [w for w in words if w[1] < 45]
    # รหัสบล็อก = คำละตินซ้ายสุดบนหัวกระดาษ เช่น "E - 1", "F - 2 - 1" · ชื่อบล็อก = คำที่เหลือ (ไทย/อังกฤษ)
    code_txt = " ".join(w[4] for w in sorted(top, key=lambda w: w[0]) if w[0] < 200 and not has_thai(w[4]))
    m = BLOCK_RE.match(code_txt.strip())
    if m:
        title = [w for w in sorted(top, key=lambda w: w[0]) if w[0] >= 200]
    else:
        # เล่มเก่า: รหัสบล็อก "F - 3" อยู่ในพื้นที่รูปด้านซ้าย (x<250, y<300) และชื่อบล็อกเป็นบรรทัดถัดลงมาใต้รหัส
        m = None
        for y, ws in group_lines([w for w in words if w[0] < 250 and w[1] < 300]):
            txt = " ".join(w[4] for w in ws if not has_thai(w[4])).strip()
            mm = BLOCK_RE.match(txt)
            if mm: m = mm; code_y = y; code_x = ws[0][0]; break
        if not m:
            return None
        title = [w for w in words if w[0] < 330 and code_y + 5 < (w[1] + w[3]) / 2 < code_y + 110 and w[1] > 20]
    block = f"{m.group(1)}-{m.group(2)}" + (f"-{m.group(3)}" if m.group(3) else "")
    name_th = clean(" ".join(w[4] for w in title if has_thai(w[4])))
    name_en = clean(" ".join(w[4] for w in title if not has_thai(w[4]) and re.search(r"[A-Za-z]", w[4])))

    # หัวตาราง
    hdr = {}
    for w in words:
        c = clean(w[4])
        if c == "ลำดับ": hdr["ref"] = w
        elif c == "หมายเลขอะไหล่": hdr["code"] = w
        elif c == "ชื่ออะไหล่": hdr["name"] = w
        elif c.startswith("หมายเลขเครื่อง"): hdr["note"] = w      # "หมายเลขเครื่องที่ใช้" หรือคำติดกัน "หมายเลขเครื่องรุ่นที่ใช้" (SUPER CUB)
        elif c.startswith("รุ่นที่ใช้"): hdr["type"] = w
        if "รุ่นที่ใช้" in c and c != "รุ่นที่ใช้" and "type" not in hdr: hdr["type"] = w
    note_x = min([hdr[k][0] for k in ("note", "type") if k in hdr], default=None)  # บางเล่มไม่มี "หมายเลขเครื่องที่ใช้" มีแต่ "รุ่นที่ใช้"
    if "code" not in hdr or note_x is None:
        return (block, name_th, name_en, [], None)
    y_hdr = hdr["code"][1]
    # หัวคอลัมน์จำนวน ซ้อนกันได้หลายบรรทัด แล้วปิดท้ายด้วยบรรทัดตัวอักษรคอลัมน์ เช่น
    #   ADV160A / P S T · ACB160 / CAT CBT / N R V N · ACF125CA ACF125CB / R S T R S T · NHX / 125 125A / S T T · WW160 / A S / S S
    # → ประกอบรหัสแบบต่อคอลัมน์จากบนลงล่าง (เลือกคำในแต่ละบรรทัดที่ช่วง x ใกล้คอลัมน์ที่สุด) = model_code เต็ม แล้วตัด base (common prefix) เป็น key
    band = [(w[0], w[1], w[2], w[3], clean(w[4])) for w in words
            if y_hdr - 30 < w[1] < y_hdr + 30 and w[0] > hdr["name"][0] + 100 and w[0] < note_x - 5]
    blines = {}
    for w in band: blines.setdefault(round(w[1] / 3), []).append(w)
    blines = [sorted(v, key=lambda w: w[0]) for k, v in sorted(blines.items())]
    y_first_row = min([w[1] for w in words if CODE_RE.match(w[4]) and w[1] > y_hdr], default=y_hdr + 30)
    blines = [ln for ln in blines if ln[0][1] < y_first_row - 1 and not any(CODE_RE.match(w[4]) or has_thai(w[4]) for w in ln)]   # เฉพาะบรรทัดเหนือแถวข้อมูลแรก ตัดแถวข้อมูล/คำไทย
    # บรรทัดตัวอักษรคอลัมน์ = บรรทัดล่างสุดที่ทุกคำเป็น token รหัส (P S T · N R V N · "4" · "T/MT C/MC" · "MT/MT1 MC/MC1" ในเล่มเก่า)
    TOKEN_RE = re.compile(r"[A-Z0-9/]{1,10}")
    letter_lines = [ln for ln in blines if ln and all(TOKEN_RE.fullmatch(w[4]) for w in ln)]
    letters = [w for w in letter_lines[-1] if TOKEN_RE.fullmatch(w[4])] if letter_lines else []
    y_letters = letters[0][1] if letters else y_hdr + 30
    above = [ln for ln in blines if ln[0][1] < y_letters - 2 and ln is not (letter_lines[-1] if letter_lines else None)]
    def nearest(ln, xc):
        return min(ln, key=lambda g: 0 if g[0] <= xc <= g[2] else min(abs(xc - g[0]), abs(xc - g[2])))[4]
    full = []
    for w in letters:
        xc = (w[0] + w[2]) / 2
        full.append("".join(nearest(ln, xc) for ln in above) + w[4])
    base = (os.path.commonprefix(full) if len(full) > 1 else (full[0][:-1] if full else None)) or None
    if base and not re.search(r"\d", base):   # common prefix สั้นผิดปกติ (ไม่มีตัวเลขรุ่น) → ใช้คำบนสุดเป็น base
        base = above[0][0][4] if above else base
    pst = letters
    # ถ้ารู้ลำดับ variant จากตารางรุ่น (col_keys) และจำนวน/ตัวท้ายตรงกับตัวอักษรคอลัมน์ → ใช้ตามนั้น (แม่นสุด)
    if col_keys and len(col_keys) == len(letters) and all(k.endswith(w[4]) for k, w in zip(col_keys, letters)):
        cols = [(k, (w[0] + w[2]) / 2) for k, w in zip(col_keys, letters)]
    else:
        cols = [((f[len(base):] if base and f.startswith(base) else f), (w[0] + w[2]) / 2) for f, w in zip(full, letters)]
    x_code = hdr["code"][0] - 3
    x_qty0 = (cols[0][1] - 10) if cols else hdr["note"][0] - 120
    x_note = note_x - 6
    x_type = hdr["type"][0] - 6 if "type" in hdr else x_note + 70  # คอลัมน์ type (TH/3TH) · ชื่ออังกฤษยาวล้ำเข้าเขต "หมายเลขเครื่อง" ได้
    y_start = (pst[0][3] if pst else hdr["code"][3]) + 1

    # ใช้ y กลางของคำ (กล่องแถวแรกอาจซ้อนกับบรรทัดตัวอักษรคอลัมน์ 1-2pt)
    body = [w for w in words if (w[1] + w[3]) / 2 > y_start and w[3] < H - 35 and w[0] > hdr["ref"][0] - 15 if "ref" in hdr]
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
    return (block, name_th, name_en, parts, base)


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

    # base code เช่น ADV160A / ACB160 จากหัวคอลัมน์จำนวนของหน้าบล็อกแรก
    base = None
    for i in range(len(doc)):
        r = parse_block_page(doc[i])
        if r and r[4]:
            base = r[4]; break
    variants = parse_variants(doc, base or model)
    if not variants and base:
        # เล่มเก่าที่ตารางรุ่นอ่านไม่ได้ → สร้าง variant จาก key คอลัมน์จำนวนของหน้าบล็อกแรก (model_code = base+key)
        for i in range(len(doc)):
            r = parse_block_page(doc[i])
            if r and r[3]:
                keys = []
                for p_ in r[3]:
                    for k in p_["qty"]:
                        if k not in keys: keys.append(k)
                variants = [{"model_code": base + k, "types": []} for k in keys]
                print(f"  ℹ ตารางรุ่นอ่านไม่ได้ → สร้าง variant จากคอลัมน์จำนวน: {[v['model_code'] for v in variants]}")
                break
    # ผูก col letter (P/S/T) กับ model_code = base + letter
    for v in variants:
        v["col"] = v["model_code"][len(base):] if base and v["model_code"].startswith(base) else v["model_code"][-1]
    col_keys = [v["col"] for v in variants]

    # วันที่พิมพ์ (หน้าคำแนะนำ)
    edition = ""
    for i in range(min(15, len(doc))):
        m = re.search(r"ตีพิมพ์เมื่อ\s*([0-9]{1,2}\s+\S+\s+\d{4})", clean(doc[i].get_text()))
        if m: edition = re.sub(r"\s+", " ", m.group(1)); break   # เล่มเก่าวันที่ขึ้นบรรทัดใหม่

    blocks, order = {}, []
    for i in range(len(doc)):
        page = doc[i]
        r = parse_block_page(page, col_keys)
        if not r:
            continue
        code, nth, nen, parts, _ = r
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

    # คอลัมน์จำนวนที่ key ไม่ตรง variant (บางหน้าหัวตารางมีตัวอักษรเกิน เช่น AMN/ARN แทน AM/AR) → จับคู่กับ col ที่เป็น prefix ยาวสุด
    col_set = {v["col"] for v in variants}
    if col_set:
        fixed = 0
        for b in blocks.values():
            for p in b["parts"]:
                if p["qty"] and not set(p["qty"]) <= col_set:
                    nq = {}
                    for k, val in p["qty"].items():
                        best = k if k in col_set else max([c for c in col_set if k.startswith(c) and len(k) - len(c) <= 1] or [k], key=len)
                        nq[best] = val
                    if nq != p["qty"]: p["qty"] = nq; fixed += 1
        if fixed: print(f"  ↺ ปรับ key คอลัมน์จำนวนให้ตรง variant {fixed} แถว")
    sections = []
    for code in order:
        s = code.split("-")[0]
        if s not in [x["key"] for x in sections]:
            sections.append({"key": s, "name": {"E": "หมวดเครื่องยนต์", "F": "หมวดตัวถัง"}.get(s, f"หมวด {s}")})

    # MODEL คั่นด้วย | ได้เมื่อเล่มเดียวคลุมหลายรุ่นในระบบ เช่น "PCX160|PCX150-HV" (เล่ม K1ZP รวม WW150/WW160) → model = ตัวแรก, models = ทั้งหมด
    models = [m.strip() for m in str(model).split("|") if m.strip()]
    out = {
        "brand": brand, "model": models[0], "models": models, "base": base, "slug": slug,
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
