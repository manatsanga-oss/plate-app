# -*- coding: utf-8 -*-
"""
สกัดข้อมูลเวลาบริการมาตรฐาน (FRT) + รายการอะไหล่ จากคู่มือรายการอะไหล่ Honda (PDF มี text layer)
ผลลัพธ์: ไฟล์ SQL INSERT สำหรับตาราง service_flat_rates

ใช้งาน:  python tools/extract_service_frt.py "<path PDF>" <MODEL> <MODEL_CODE>
ตัวอย่าง: python tools/extract_service_frt.py "C:/.../PL-PCX150-(KZYA).PDF" PCX150 KZYA
"""
import sys, io, re, os

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import pdfplumber

OUT_DIR = r"C:\Users\manat\OneDrive\New folder\โฟลเดอร์ใหม่"

# ── ทำความสะอาดข้อความจากฟอนต์ Honda ──
COMBINING = "ัิีึืุู็่้๊๋์ำ"

def clean(s):
    # ฟอนต์ Honda ทำสระ ำ เป็น U+FFFD (อาจมีวรรณยุกต์คั่น เช่น น�้า = น้ำ)
    s = re.sub("�([่-๋]?)า", "\\1ำ", s)
    s = s.replace("�", "")
    # ลบช่องว่างที่แทรกก่อนสระ/วรรณยุกต์ เช่น "ไอด ี" -> "ไอดี"
    s = re.sub(r"\s+([" + COMBINING + r"])", r"\1", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()

def norm_name(s):
    """ชื่อสำหรับจับคู่ part <-> FRT: ตัดวงเล็บ/ช่องว่าง"""
    s = re.sub(r"\([^)]*\)", "", s)
    s = s.replace(" ", "").strip()
    return s

PAT_SECTION = re.compile(r"^([A-Z])\s*-\s*(\d+)$")
PAT_PART = re.compile(
    r"^(\d{1,3})\s+(\d{5}-[A-Z0-9]{2,4}-[A-Z0-9]{2,4})\s+(.+?)\s*\.{2,}\s*(\d+)(?:\s+\d+)*\s+(.+?)$"
)
PAT_FRT = re.compile(r"^(.+?)\s*\.{2,}\s*\(?\*?(\d{1,2}\.\d)\)?\*?$")
PAT_FRT_DITTO = re.compile(r"^(.+?)\s*\.{2,}\s*[\"”]$")
PAT_SECTION_PREFIX = re.compile(r"^[A-Z]\s*-\s*\d+\s+")
# ชื่อ section แบบ inline (WAVE110i): "ไส้กรองอากาศ AIR CLEANER" ในบรรทัดเดียวกับ section code
PAT_SECTION_NAME = re.compile(
    r"^([ก-๙][ก-๙\s,./()-]*?)\s+([A-Z][A-Za-z\s,./()&-]+)$"
)


def extract(path, model, model_code):
    pdf = pdfplumber.open(path)
    sections = {}   # code -> {"th":..., "en":...}
    frt_jobs = []   # (section, job_name, hours)
    parts = []      # (section, ref, part_no, th, qty, en)
    seen_parts = set()    # tuples (section, ref, part_no) — กัน dup จาก PDF layout ซ้ำหน้า
    seen_jobs = set()     # tuples (section, norm_name) — กัน dup ของ FRT jobs
    cur_sec = None
    pending_name = {"th": False, "en": False}
    last_frt_time = None

    SEG = re.compile(r"\S+(?:\s{1,2}\S+)*")  # ก้อนข้อความที่คั่นด้วยช่องว่าง >= 3 ตัว
    LEFT_COL = 45

    for pno, page in enumerate(pdf.pages, start=1):
        text = page.extract_text(layout=True) or ""
        raw_lines = text.splitlines()
        # section code ปรากฏหนึ่งครั้งต่อหน้า (อาจอยู่กลางหน้า/ปนคอลัมน์ขวา) → ใช้กับทั้งหน้า
        for raw in raw_lines:
            found_sec_in_line = False
            for m in SEG.finditer(raw):
                ms = PAT_SECTION.match(clean(m.group()))
                if ms and m.start() < LEFT_COL:
                    cur_sec = f"{ms.group(1)}-{ms.group(2)}"
                    if cur_sec not in sections:
                        sections[cur_sec] = {"th": "", "en": ""}
                        pending_name = {"th": True, "en": True}
                    found_sec_in_line = True
                    break
            if found_sec_in_line:
                # WAVE110i layout: ชื่อ section อยู่บรรทัดเดียวกับ code → ดึงจาก segment เดียวกันให้ทันก่อนถูก
                # override ด้วย column headers
                if pending_name["th"]:
                    for m2 in SEG.finditer(raw):
                        seg2 = clean(m2.group())
                        mn = PAT_SECTION_NAME.match(seg2)
                        if mn:
                            th_part = mn.group(1).strip()
                            en_part = mn.group(2).strip()
                            if th_part and en_part and len(th_part) < 60 and len(en_part) < 60:
                                sections[cur_sec]["th"] = th_part
                                sections[cur_sec]["en"] = en_part
                                pending_name = {"th": False, "en": False}
                                break
                break

        for raw in raw_lines:
            for m in SEG.finditer(raw):
                seg = clean(m.group())
                pos = m.start()
                if not seg or PAT_SECTION.match(seg):
                    continue

                mp = PAT_PART.match(seg)
                if mp and cur_sec and pos < LEFT_COL:
                    ref, pno_, th, qty, en = mp.groups()
                    key = (cur_sec, int(ref), pno_)
                    if key not in seen_parts:
                        seen_parts.add(key)
                        parts.append((cur_sec, int(ref), pno_, clean(th), int(qty), en.strip()))
                    continue

                # FRT (คอลัมน์ขวา) — ข้ามบรรทัดหมายเหตุที่ขึ้นต้นด้วย "."
                if seg.startswith("."):
                    continue
                mf = PAT_FRT.match(seg)
                if mf and cur_sec:
                    name = PAT_SECTION_PREFIX.sub("", clean(mf.group(1))).strip()
                    if name and not re.match(r"^\d", name):
                        jkey = (cur_sec, norm_name(name))
                        if jkey not in seen_jobs:
                            seen_jobs.add(jkey)
                            frt_jobs.append((cur_sec, name, float(mf.group(2))))
                        last_frt_time = float(mf.group(2))
                    continue
                md = PAT_FRT_DITTO.match(seg)
                if md and cur_sec and last_frt_time is not None:
                    name = PAT_SECTION_PREFIX.sub("", clean(md.group(1))).strip()
                    if name:
                        jkey = (cur_sec, norm_name(name))
                        if jkey not in seen_jobs:
                            seen_jobs.add(jkey)
                            frt_jobs.append((cur_sec, name, last_frt_time))
                    continue

                # ชื่อหมวด: คอลัมน์ซ้ายเท่านั้น ไทยก่อน แล้วอังกฤษ (ไม่มีจุด/ตัวเลข)
                if cur_sec and pos < LEFT_COL and "." not in seg and not re.search(r"\d", seg):
                    if pending_name["th"] and re.search(r"[ก-๙]", seg) and len(seg) < 60:
                        sections[cur_sec]["th"] = seg
                        pending_name["th"] = False
                        continue
                    if pending_name["en"] and not pending_name["th"] and re.match(r"^[A-Za-z ,./()-]+$", seg) and len(seg) < 60:
                        sections[cur_sec]["en"] = seg
                        pending_name["en"] = False
                        continue

    # ── จับคู่ part -> FRT ภายในหมวดเดียวกัน ──
    frt_by_sec = {}
    for sec, name, hrs in frt_jobs:
        frt_by_sec.setdefault(sec, []).append((norm_name(name), name, hrs))

    rows = []
    matched_jobs = set()
    for sec, ref, part_no, th, qty, en in parts:
        n = norm_name(th)
        hrs = None
        for jn, jname, jhrs in frt_by_sec.get(sec, []):
            if jn == n or (len(jn) > 3 and (n.startswith(jn) or jn.startswith(n))):
                hrs = jhrs
                matched_jobs.add((sec, jn))
                break
        rows.append((sec, ref, part_no, th, en, qty, hrs))

    # FRT jobs ที่ไม่มี part จับคู่ → เก็บเป็นแถวงานล้วน (ค้นด้วยชื่อได้)
    seen = set()
    for sec, name, hrs in frt_jobs:
        key = (sec, norm_name(name))
        if key in matched_jobs or key in seen:
            continue
        seen.add(key)
        rows.append((sec, None, None, name, None, None, hrs))

    return sections, rows, len(parts), len(frt_jobs)


def esc(s):
    return s.replace("'", "''") if s else s


def main():
    path, model, model_code = sys.argv[1], sys.argv[2], sys.argv[3]
    sections, rows, n_parts, n_jobs = extract(path, model, model_code)

    out = os.path.join(OUT_DIR, f"Service_Flat_Rate_{model}_Inserts.sql")
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"-- ข้อมูล FRT จาก {os.path.basename(path)} (generate อัตโนมัติ)\n")
        f.write(f"DELETE FROM service_flat_rates WHERE model = '{model}' AND model_code = '{model_code}';\n")
        for sec, ref, part_no, th, en, qty, hrs in rows:
            s = sections.get(sec, {"th": "", "en": ""})
            vals = [
                f"'{model}'", f"'{model_code}'", f"'{sec}'",
                f"'{esc(s['th'])}'", f"'{esc(s['en'])}'",
                str(ref) if ref is not None else "NULL",
                f"'{part_no}'" if part_no else "NULL",
                f"'{esc(th)}'" if th else "NULL",
                f"'{esc(en)}'" if en else "NULL",
                str(qty) if qty is not None else "NULL",
                str(hrs) if hrs is not None else "NULL",
            ]
            f.write(
                "INSERT INTO service_flat_rates (model, model_code, section_code, section_name, section_name_en, ref_no, part_no, part_name, part_name_en, qty, frt_hours) VALUES ("
                + ", ".join(vals) + ");\n"
            )

    with_frt = sum(1 for r in rows if r[6] is not None and r[2])
    job_only = sum(1 for r in rows if r[2] is None)
    print(f"sections: {len(sections)}")
    print(f"parts: {n_parts} (มี FRT {with_frt})")
    print(f"frt jobs: {n_jobs} (งานล้วนไม่มี part: {job_only})")
    print(f"rows total: {len(rows)}")
    print(f"saved: {out}")
    # ตัวอย่าง 10 แถวที่มีทั้ง part_no และ FRT
    shown = 0
    for sec, ref, part_no, th, en, qty, hrs in rows:
        if part_no and hrs is not None:
            print(f"  {sec} {part_no} {th} -> {hrs}")
            shown += 1
            if shown >= 10:
                break


if __name__ == "__main__":
    main()
