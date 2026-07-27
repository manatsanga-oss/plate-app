# -*- coding: utf-8 -*-
"""นำเข้าสมุดภาพชุดสี Yamaha เป็นชุด — อ่านหัวหน้า "รถสี X รหัสสี : NNNN, GRADE TYPE"
ใช้: python tools/build_yam_batch.py            (นำเข้าทุกไฟล์ในโฟลเดอร์ที่ยังไม่มีใน catalog)
โครงข้อมูล Yamaha: model_code = ชื่อรุ่น (คงที่) · type = รหัส 4 ตัว (BTF2) · code = เลขสี · color_code = เกรดสี
"""
import sys, os, re, json, shutil
sys.stdout.reconfigure(encoding='utf-8')
import pdfplumber
import pypdfium2 as pdfium

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, 'public', 'parts-pdf')
IMG_DIR = os.path.join(ROOT, 'public', 'parts-img')
JSON_DIR = os.path.join(ROOT, 'src', 'data', 'models')
SRC = r'C:\Users\manat\OneDrive\Desktop\สมุดรูปภาพชุดสี YAMAHA'

CODE_RE = re.compile(r'^[0-9A-Z]{3}-[A-Z0-9]{5}-[0-9A-Z]{2}(-[A-Z0-9]+)?$')
# บางเล่มมีสระ/วรรณยุกต์ไทยหลงมาหน้าเกรดสี (เช่น "1892,ฺMDRNP1") → อนุญาตอักษรไทยคั่นได้
HEAD_RE = re.compile(r'รถสี\s*(.+?)\s*รหัสสี\s*:\s*([0-9A-Z]{3,4})\s*,\s*[฀-๿]*\s*([A-Z0-9]+)\s+([0-9A-Z]{3,4})\b')
# เล่มใหม่บางเล่ม (Aerox BWR, YZF-R3 BRA9) ไม่มีคำว่า "รถสี" นำหน้า — ชื่อสีไทยอยู่คนละบรรทัด
HEAD2_RE = re.compile(r'รหัสสี\s*:\s*([0-9A-Z]{3,4})\s*,\s*[฀-๿]*\s*([A-Z0-9]+)\s+([0-9A-Z]{3,4})\b')
THAINAME_RE = re.compile(r'(?:^|\n)\s*(?:รถ)?สี?\s*((?:น้ำเงิน|ขาว|ดำ|เทา|แดง|เขียว|เหลือง|ส้ม|ชมพู|ฟ้า|ม่วง|น้ำตาล|เงิน|ทอง|บรอนซ์)(?:\s*/\s*(?:น้ำเงิน|ขาว|ดำ|เทา|แดง|เขียว|เหลือง|ส้ม|ชมพู|ฟ้า|ม่วง|น้ำตาล|เงิน|ทอง|บรอนซ์))?)\s*(?:[A-Z]|$)', re.M)
NAME_STRIP = re.compile(r'\s*(New\b.*|NMAX.*|GRAND.*|FINN.*|AEROX.*|FAZZIO.*|XMAX.*|QBIX.*|FINO.*|FREEGO.*|GT125.*|MT-?\d+.*|R\s?15.*|R3.*|EXCITER.*|PG-?1.*)$', re.I)

# ไฟล์ → (slug catalog, ชื่อรุ่นใน model_code, ชื่อรุ่นแสดงผล, series, cc)
JOBS = {
    '31btm431t1.pdf':                    ('yam_nmax', 'NMAX', 'NMAX', 'N-MAX', '155'),
    'btf1.pdf':                          ('yam_nmax', 'NMAX', 'NMAX', 'N-MAX', '155'),
    'btm1.pdf':                          ('yam_nmax', 'NMAX', 'NMAX', 'N-MAX', '155'),
    '30bwr431t1.pdf':                    ('yam_aerox', 'Aerox', 'Aerox', 'Aerox', '155'),
    'aerox-155-(monster)-(bf6j).pdf':    ('yam_aerox', 'Aerox', 'Aerox', 'Aerox', '155'),
    'aerox-155-motogp-edition(bf64).pdf': ('yam_aerox', 'Aerox', 'Aerox', 'Aerox', '155'),
    'bkf67.pdf':                         ('yam_fazzio', 'Fazzio', 'Fazzio', 'Fazzio', '125'),
    'bjkab.pdf':                         ('yam_grandfilano', 'Grand Filano Hybrid', 'Grand Filano', 'Grand Filano', '125'),
    'b8b4-5-for-post.pdf':               ('yam_grandfilano', 'Grand Filano Hybrid', 'Grand Filano', 'Grand Filano', '125'),
    'grand-filano-hybrid-(b8b1-2).pdf':  ('yam_grandfilano', 'Grand Filano Hybrid', 'Grand Filano', 'Grand Filano', '125'),
    'grand-filano(2bl7_8_9).pdf':        ('yam_grandfilano', 'Grand Filano Hybrid', 'Grand Filano', 'Grand Filano', '125'),
    'bkat.pdf':                          ('yam_xmax', 'XMAX 300', 'XMAX', 'X-MAX 300', '300'),
    'bkav.pdf':                          ('yam_xmax', 'XMAX 300', 'XMAX', 'X-MAX 300', '300'),
    'xmax-300-(b74l).pdf':               ('yam_xmax', 'XMAX 300', 'XMAX', 'X-MAX 300', '300'),
    'finn-2019.pdf':                     ('yam_finn', 'FINN', 'FINN', 'FINN', '115'),
    '30d18431t1.pdf':                    ('yam_pg1', 'PG-1', 'PG-1', 'PG-1', '114'),
    '30bra431t1.pdf':                    ('yam_r3', 'YZF-R3', 'R3', 'R-3', '321'),
    'r3-all-new-(b5l6).pdf':             ('yam_r3', 'YZF-R3', 'R3', 'R-3', '321'),
    'r15-all-new-(b9b5).pdf':            ('yam_r15', 'YZF-R15', 'R15', 'R-15', '155'),
    'r15-all-new-(monster)-(b9b8).pdf':  ('yam_r15', 'YZF-R15', 'R15', 'R-15', '155'),
    'yzf-r155.pdf':                      ('yam_r15', 'YZF-R15', 'R15', 'R-15', '155'),
    'mt-15-(b7d1).pdf':                  ('yam_mt15', 'MT-15', 'MT-15', 'MT-15', '155'),
    'mt-03(b08e).pdf':                   ('yam_mt03', 'MT03', 'MT-03', 'MT-03', '321'),
    'exciter-(b157).pdf':                ('yam_exciter', 'Exciter', 'Exciter', 'Exciter', '155'),
    'qbix-2019.pdf':                     ('yam_qbix', 'QBIX', 'QBIX', 'QBIX', '125'),
    'fino-125.pdf':                      ('yam_fino', 'FINO', 'FINO125', 'FINO', '125'),
    'freego-(b0p4).pdf':                 ('yam_freego', 'FREEGO', 'FREEGO', 'FREEGO', '125'),
    'gt125-(b215-b2h3).pdf':             ('yam_gt125', 'GT125', 'GT125', 'GT125', '125'),
    'gt125-2020-(b216-b2h4).pdf':        ('yam_gt125', 'GT125', 'GT125', 'GT125', '125'),
    # ── ปี 2024 ──
    'rev-30b6f431t1.pdf':                ('yam_finn', 'FINN', 'FINN', 'FINN', '115'),
    '30b1v431t1.pdf':                    ('yam_xsr', 'XSR155', 'XSR155', 'XSR', '155'),
    '30bjk431ta.pdf':                    ('yam_grandfilano', 'Grand Filano Hybrid', 'Grand Filano', 'Grand Filano', '125'),
    '30bjk431t1.pdf':                    ('yam_grandfilano', 'Grand Filano Hybrid', 'Grand Filano', 'Grand Filano', '125'),
    'beve-of-post.pdf':                  ('yam_mt03', 'MT03', 'MT-03', 'MT-03', '321'),
    'bkf8-for-post.pdf':                 ('yam_fazzio', 'Fazzio', 'Fazzio', 'Fazzio', '125'),
    'bkw23-for-post.pdf':                ('yam_pg1', 'PG-1', 'PG-1', 'PG-1', '114'),
    'bbrefg-for-post.pdf':               ('yam_aerox', 'Aerox', 'Aerox', 'Aerox', '155'),
    '1zbwk431t1.pdf':                    ('yam_exciter', 'Exciter', 'Exciter', 'Exciter', '155'),
    'b7d6-mt15.pdf':                     ('yam_mt15', 'MT-15', 'MT-15', 'MT-15', '155'),
    'b2xw-r3.pdf':                       ('yam_r3', 'YZF-R3', 'R3', 'R-3', '321'),
    'bkac.pdf':                          ('yam_xmax', 'XMAX', 'XMAX', 'X-MAX 300', '300'),
}


def codes_of(pg):
    W, H = pg.width, pg.height
    rows, seen = [], set()
    for w in pg.extract_words():
        t = w['text']
        if '*' in t or t in seen or not CODE_RE.match(t):
            continue
        seen.add(t)
        rows.append({'code': t,
                     'x': round(w['x0'] / W * 100, 2), 'y': round(w['top'] / H * 100, 2),
                     'w': round((w['x1'] - w['x0']) / W * 100, 2),
                     'h': round((w['bottom'] - w['top']) / H * 100, 2)})
    return rows


only = sys.argv[1:] or None
total_add = total_skip = 0
for fn, (slug, baeb, model, series, cc) in JOBS.items():
    if only and fn not in only:
        continue
    path = os.path.join(SRC, fn)
    if not os.path.exists(path):
        print('ไม่พบไฟล์:', fn); continue
    jpath = os.path.join(JSON_DIR, '%s_color_parts.json' % slug)
    if os.path.exists(jpath):
        data = json.load(open(jpath, encoding='utf-8'))
    else:
        data = {'file': '', 'model': model, 'model_code': '', 'title': '%s สมุดรูปภาพชุดสี' % model,
                'pdf_url': '/parts-pdf/%s' % fn, 'colors': [], 'pages': {}, 'series': series, 'brand': 'YAMAHA'}
    img_dir = os.path.join(IMG_DIR, slug)
    os.makedirs(img_dir, exist_ok=True)
    have = {(str(c.get('type', '')).upper(), str(c.get('code', '')).upper()) for c in data['colors']}
    keys = set(data['pages'].keys())
    add = skip = 0
    doc = pdfium.PdfDocument(path)
    with pdfplumber.open(path) as pdf:
        for i, pg in enumerate(pdf.pages):
            txt = pg.extract_text() or ''
            m = HEAD_RE.search(txt)
            if m:
                name = NAME_STRIP.sub('', m.group(1)).strip()
                paint, grade, typ = m.group(2), m.group(3), m.group(4)
            else:
                m2 = HEAD2_RE.search(txt)
                if not m2:
                    continue
                paint, grade, typ = m2.group(1), m2.group(2), m2.group(3)
                mt = THAINAME_RE.search(txt)
                name = (mt.group(1).replace(' ', '') if mt else paint)
            rows = codes_of(pg)
            if not rows:
                continue
            # type ในระบบ (DMS/master) = รหัสสมุดภาพ 4 หลัก + "00" เสมอ
            if re.fullmatch(r'[0-9A-Z]{4}', typ):
                typ += '00'
            if (typ.upper(), paint.upper()) in have:
                skip += 1
                continue
            have.add((typ.upper(), paint.upper()))
            key = '%s_%s' % (typ.lower(), paint.lower())
            n = 0
            while key in keys:
                n += 1
                key = '%s_%s_%d' % (typ.lower(), paint.lower(), n)
            keys.add(key)
            data['pages'][key] = rows
            img = '/parts-img/%s/%s.jpg' % (slug, key)
            data['colors'].append({'code': paint, 'name': name, 'color_code': grade, 'page': key,
                                   'pages': [key], 'img': img, 'imgs': [img],
                                   'model_code': baeb, 'type': typ})
            doc[i].render(scale=2.5).to_pil().convert('RGB').save(os.path.join(img_dir, '%s.jpg' % key), 'JPEG', quality=82)
            add += 1
    cur = [x for x in (data.get('file') or '').split(',') if x]
    if fn not in cur:
        cur.append(fn)
    data['file'] = ','.join(sorted(cur))
    json.dump(data, open(jpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    if not os.path.exists(os.path.join(PDF_DIR, fn)):
        shutil.copy(path, os.path.join(PDF_DIR, fn))
    total_add += add; total_skip += skip
    print('%-38s → %-16s +%2d สี%s (รวม %d)' % (fn, slug, add, (' · ซ้ำ %d' % skip) if skip else '', len(data['colors'])))
print('\nรวมเพิ่ม %d สี · ข้ามซ้ำ %d' % (total_add, total_skip))
