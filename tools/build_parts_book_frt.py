# -*- coding: utf-8 -*-
"""สกัด "เวลาในการบริการ" (FRT, ชั่วโมง) จากคู่มือรายการอะไหล่ Honda (PL-*.PDF) → src/data/part_frt.json

แต่ละบล็อกในคู่มือมีตาราง "หัวข้อการบริการ / เวลาในการบริการ" บรรทัดละ  <ลำดับ> <ชื่ออะไหล่>......<ชั่วโมง>
<ลำดับ> = ลำดับเดียวกับตารางอะไหล่ของบล็อกนั้น → จับคู่กับรหัสอะไหล่ด้วยลำดับ (ไม่ต้องเทียบชื่อ จึงใช้ได้กับเล่มฟอนต์เพี้ยน)

ใช้ข้อมูลบล็อก/ลำดับ/รหัสจาก src/data/partsbooks/<slug>_parts_book.json (สร้างด้วย build_parts_book.py) + PDF ตามช่อง "file"
รัน:  python tools/build_parts_book_frt.py            (ทุกเล่ม)
      python tools/build_parts_book_frt.py adv160 -v  (เล่มเดียว + แสดงรายละเอียด)
ผลลัพธ์: { "<รหัสไม่มีขีด>": [ {"m": รุ่น, "s": slug, "b": บล็อก, "h": ชั่วโมง, "j": ชื่อหัวข้อ}, ... ] }
"""
import glob, json, os, re, sys
import fitz

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_parts_book import clean  # แปลงฟอนต์ไทยแมคเก่า + ตัดอักษรขยะ

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOK_DIR = os.path.join(ROOT, "src", "data", "partsbooks")
OUT = os.path.join(ROOT, "src", "data", "part_frt.json")
PDF_DIRS = [
    r"C:\Users\manat\OneDrive\ระบบงาน 4\สมุดรายการอะไหล่",
    r"C:\Users\manat\OneDrive\Desktop\สมุดรูปภาพอะไหล่",
]
CODE_RE = re.compile(r"\b[0-9A-Z]{5}-[0-9A-Z]{3,5}(?:-[0-9A-Z]{2,4})?\b")
# <ลำดับ> <ชื่อ>....<ชม.>   (จุดไข่ปลา ≥3 ตัว, เวลาทศนิยม 1 ตำแหน่ง)
FRT_RE = re.compile(r"^\s*(\d{1,3})\s+(\S.*?)\s*\.{3,}\s*(\d{1,2}\.\d)\s*$")
norm = lambda s: re.sub(r"[^A-Z0-9]", "", str(s or "").upper())


def find_pdf(name):
    for d in PDF_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return None


def page_lines(page):
    """บรรทัดข้อความของหน้า (รวม span ที่อยู่ y เดียวกันในบล็อกเดียวกัน)"""
    # ใช้ข้อความล้วน (ไม่ดึงรูป) — get_text("dict") แกะรูป diagram ทุกหน้า ช้ามาก
    return [t for t in page.get_text("text").split("\n") if t.strip()]


NAME_ONLY_RE = re.compile(r"^\s*(\S.*?)\s*\.{3,}\s*(\d{1,2}\.\d)\s*$")


def name_key(s):
    """ชื่อสำหรับเทียบ: ตัดวงเล็บ (ยี่ห้อ/สเปก) + ช่องว่าง + เครื่องหมาย"""
    s = clean(s or "")
    s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[\s,.:;*\-]", "", s)


def page_frt(lines):
    """คืน [(ลำดับ|None, ชื่อหัวข้อ, ชั่วโมง)] ของหน้า
    เล่มใหม่: "<ลำดับ> <ชื่อ>....<ชม.>" · เล่มเก่า: ไม่มีลำดับ มีแต่ "<ชื่อ>....<ชม.>" → ไปเทียบชื่อกับอะไหล่ในบล็อก"""
    out = []
    for t in lines:
        t = t.replace("	", " ")
        m = FRT_RE.match(t)
        if m:
            out.append((int(m.group(1)), clean(m.group(2)), float(m.group(3))))
            continue
        m = NAME_ONLY_RE.match(t)
        if m and not re.match(r"^\s*\d", t):
            out.append((None, clean(m.group(1)), float(m.group(2))))
    return out


# ชื่อรุ่นในเล่ม → ชื่อรุ่นของระบบ (marketing_name ใน master ที่หน้ารายงานอะไหล่หมุนเร็วใช้เป็น "รุ่นที่ใช้")
BOOK_RUN = {"ADV150": "ADV150", "ADV160": "ADV160", "ADV350": "ADV350", "CBR150R": "CBR150R", "CL300": "CL300",
            "CLICK125": "Click125", "CLICK150": "Click150", "CLICK160": "Click160", "SUPER CUB / DREAM110i": "Super",
            "FORZA300": "Forza300", "FORZA350": "Forza350", "GIORNO+": "GIORNO+", "GROM": "MSX", "LEAD125": "Lead125",
            "MOOVE": "MOOVE", "PCX125": "PCX125", "PCX150": "PCX150", "PCX160": "PCX160", "PCX150-HV": "PCX150 Hybrid",
            "REBEL300": "Rebel300", "SCOOPY": "Scoopy", "SONIC125": "Sonic", "WAVE110": "Wave110i", "WAVE125": "Wave125",
            "ZOOMER-X": "Zoomer-X"}


def book_runs(book):
    runs = []
    for m in (book.get("models") or [book.get("model")]):
        r = BOOK_RUN.get(m, m)
        if r and r not in runs:
            runs.append(r)
    if any(str(v.get("model_code", "")).upper().startswith("WW150") and "HV" not in str(v.get("model_code", "")).upper() for v in book.get("variants", [])) and "PCX150" not in runs:
        runs.append("PCX150")   # เล่ม K1ZP คลุม PCX150 (WW150M/N) ด้วย
    return runs


def thai_key(s):
    """ชื่อหัวข้อสำหรับเทียบกับชื่อสินค้า: ตัดวงเล็บ เหลือเฉพาะอักษรไทย + ปรับตัวสะกดที่เขียนต่างกัน (ต้องตรงกับ src/lib/partFrt.js)"""
    s = re.sub(r"\(.*?\)", "", clean(s or ""))
    s = "".join(ch for ch in s if "ก" <= ch <= "๎")
    return s.replace("เบรค", "เบรก").replace("ใส้", "ไส้").replace("ดิสค์", "ดิสก์").replace("โช๊ค", "โช้ก").replace("โช้ค", "โช้ก")


def build_book(path, verbose=False):
    book = json.load(open(path, encoding="utf-8"))
    slug = book.get("slug") or os.path.basename(path).replace("_parts_book.json", "")
    pdf = find_pdf(book.get("file", ""))
    if not pdf:
        print(f"  !! {slug}: ไม่พบ PDF {book.get('file')}")
        return slug, book, [], {"pages": 0, "lines": 0, "matched": 0, "noblock": 0, "noref": 0}
    # ดัชนี: รหัส → บล็อกที่มีรหัสนั้น
    blocks = book["blocks"]
    code_blocks = {}
    for bi, bl in enumerate(blocks):
        for p in bl["parts"]:
            code_blocks.setdefault(norm(p["code"]), set()).add(bi)
    doc = fitz.open(pdf)
    res = []
    st = {"pages": 0, "lines": 0, "matched": 0, "noblock": 0, "noref": 0}
    for pno, page in enumerate(doc):
        lines = page_lines(page)
        frt = page_frt(lines)
        if not frt:
            continue
        st["pages"] += 1
        st["lines"] += len(frt)
        text = "\n".join(lines)
        votes = {}
        for c in set(CODE_RE.findall(text)):
            for bi in code_blocks.get(norm(c), ()):
                votes[bi] = votes.get(bi, 0) + 1
        if not votes:
            st["noblock"] += len(frt)
            continue
        # บล็อกของหน้านี้ = บล็อกที่รหัสบนหน้าตรงมากที่สุด (เสมอกัน → บล็อกที่หน้าแรกใกล้หน้านี้)
        bi = max(votes, key=lambda k: (votes[k], -abs((blocks[k].get("page") or 0) - (pno + 1))))
        bl = blocks[bi]
        page_codes = {norm(c) for c in CODE_RE.findall(text)}
        for ref, job, hrs in frt:
            if ref is None:   # เล่มเก่า: เทียบชื่อ (ตัดวงเล็บ) ต้องตรงกันทั้งชื่อ
                jk = name_key(job)
                parts = [p for p in bl["parts"] if jk and name_key(p.get("name_th")) == jk]
                if not parts and jk:   # เล่มฟอนต์แมคเก่า: ตัว "ส" (NBSP) หายจากข้อความล้วน → เทียบแบบไม่นับ ส
                    j2 = jk.replace("ส", "")
                    parts = [p for p in bl["parts"] if j2 and name_key(p.get("name_th")).replace("ส", "") == j2]
            else:
                parts = [p for p in bl["parts"] if str(p.get("ref", "")).strip() == str(ref)]
            # บล็อกหลายหน้า: ลำดับเดียวกันอาจซ้ำข้ามหน้า → เอาเฉพาะรหัสที่อยู่บนหน้านี้ก่อน
            on_page = [p for p in parts if norm(p["code"]) in page_codes]
            parts = on_page or parts
            if not parts:
                st["noref"] += 1
                if verbose:
                    print(f"    ? หน้า {pno+1} {bl['code']} ลำดับ {ref} ไม่ตรงอะไหล่ในบล็อก: {job} {hrs}")
                continue
            st["matched"] += 1
            for p in parts:
                res.append({"code": norm(p["code"]), "block": bl["code"], "ref": ref, "hours": hrs,
                            "job": (p.get("name_th") or job or "").strip(), "page": pno + 1})
            if verbose:
                print(f"    หน้า {pno+1} {bl['code']} #{ref} {hrs} ชม. → {', '.join(p['code'] for p in parts)} | {parts[0].get('name_th','')}")
    return slug, book, res, st


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    verbose = "-v" in sys.argv
    files = sorted(glob.glob(os.path.join(BOOK_DIR, "*_parts_book.json")))
    if args:
        files = [f for f in files if os.path.basename(f).replace("_parts_book.json", "") in args]
    books, codes, jobs = [], {}, []
    tot = 0
    for f in files:
        slug, book, res, st = build_book(f, verbose)
        bi = len(books)
        books.append({"s": slug, "r": book_runs(book), "e": book.get("edition") or ""})
        seen = set()
        jb = {}
        for r in res:
            k = thai_key(r["job"])
            if k:
                jb.setdefault(k, set()).add(r["hours"])
            key = (r["code"], r["block"], r["hours"])
            if key in seen:
                continue
            seen.add(key)
            codes.setdefault(r["code"], []).append([bi, r["block"], r["hours"]])
        # ชื่อหัวข้อ → เวลา (ไว้เทียบด้วยชื่อ เมื่อรหัสอะไหล่ไม่อยู่ในเล่ม เช่น แบตฯ/ยาง คนละยี่ห้อ) · หลายค่า = [ต่ำสุด, สูงสุด]
        jobs.append({k: (min(v) if len(v) == 1 else [min(v), max(v)]) for k, v in sorted(jb.items())})
        tot += len(seen)
        print(f"{slug:<14} หน้าที่มีเวลา {st['pages']:>3} | บรรทัดเวลา {st['lines']:>4} | จับคู่ได้ {st['matched']:>4} | หาบล็อกไม่ได้ {st['noblock']:>3} | ลำดับไม่ตรง {st['noref']:>3} | รหัส {len(seen)} | หัวข้อ {len(jb)}")
    if not args:
        out = {"books": books, "codes": dict(sorted(codes.items())), "jobs": jobs}
        json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(f"\nเขียน {OUT}: {len(codes)} รหัส / {tot} รายการ / {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
