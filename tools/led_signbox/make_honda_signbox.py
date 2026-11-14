# กล่องไฟ LED "HONDA" ครอบปลั๊กไฟบนเสาเหนือจอประชาสัมพันธ์ (ร้าน ป.เปา) — user 2026-11-12
# วัดจากรูป: เสากว้าง ~200 มม. · หน้ากากปลั๊ก 120x70 (แนวนอน) · ขอบล่างหน้ากากสูงจากขอบจอ ~30 มม. · ปลั๊ก+อะแดปเตอร์ยื่นจากผนัง ~80 มม.
# ชิ้นงาน (พิมพ์ไม่ต้องใช้ซัพพอร์ต):
#   1) signbox_shell.stl  ตัวกล่อง: หน้า + ซ้าย + ขวา + ล่าง (หลังเปิด = ผนัง, บนเปิด = ฝา) — พิมพ์คว่ำหน้าลงเตียง
#        หน้าหนา 3 มม.: ตัวอักษร HONDA เป็นร่องลึก 2 มม. จากด้านใน เหลือผิวหน้า 1 มม.
#        → สั่ง "เปลี่ยนสีเส้นที่ความสูง 1.0 มม." (ขาวก่อน แล้วดำ/แดง) ตัวอักษรจะเป็นสีขาวโปร่งแสงเรืองเมื่อเปิดไฟ ไม่ต้องมีสะพานยึดไส้ตัว O/D/A
#   2) signbox_lid.stl    ฝาบน: แผ่น + ขอบเสียบ 3 ด้าน (ซ้าย/ขวา/หน้า) มีช่องระบายร้อน — พิมพ์หงายแผ่นลงเตียง
#   3) signbox_bracket.stl ขายึดผนังรูปตัว L x2: ยึดผนังด้วยสกรู/เทป 3M แล้วสวมกล่อง ขันสกรู M3 ผ่านผนังข้างกล่องเข้าลิ้นขายึด
# ไฟ: เส้น LED USB 5V ติดผนังด้านในรอบหน้ากล่อง เสียบช่อง USB ของอะแดปเตอร์ในกล่อง
# output: C:\Users\manat\OneDrive\New folder\honda-signbox-3d-print\
import os, sys, math, importlib.util
import numpy as np
import trimesh
from manifold3d import Manifold, CrossSection, FillRule, JoinType

OUT = r"C:\Users\manat\OneDrive\New folder\honda-signbox-3d-print"
FONT = r"C:\Windows\Fonts\ariblk.ttf"      # Arial Black — ตัวหนากว้างใกล้เคียงโลโก้ตัวอักษร HONDA (ไม่มีฟอนต์โลโก้จริง)
TEXT = "HONDA"
# 2026-11-12 user ส่งไฟล์โลโก้ทางการ (ปีกนก + HONDA) "เอาแบบนี้ดีกว่า" → ใช้เส้นจากไฟล์แทนฟอนต์ (ไฟล์ .ai เป็น PDF อ่านด้วย PyMuPDF)
LOGO_AI = r"C:\Users\manat\OneDrive\New folder (4)\wing_honda พื้นขาว.ai"   # ไม่พบไฟล์ = กลับไปใช้ฟอนต์ Arial Black
LOGO_MARGIN_X, LOGO_MARGIN_Y = 14.0, 9.0   # ขอบเว้นรอบโลโก้บนหน้ากล่อง

# ---------------- ขนาด (มม.) — แก้ตรงนี้ถ้าวัดจริงต่าง ----------------
W, H, D = 180.0, 130.0, 95.0     # กว้าง x สูง x ลึก (ยื่นจากผนัง) ภายนอก — เสากว้าง 200 เหลือข้างละ 10
WALL = 2.4                       # ผนังข้าง/ล่าง
# 2026-11-12 user: มีเส้นสีขาวอย่างเดียว คำว่า HONDA จะตัดสติ๊กเกอร์มาปิดเอง → หน้ากล่องเป็นแผ่นขาวเรียบบาง 1.2 มม. (แสงทะลุสม่ำเสมอ) ไม่เซาะตัวอักษร
ENGRAVE_TEXT = False             # True = เซาะร่องตัวอักษรด้านใน (ใช้กับการพิมพ์ 2 สี เปลี่ยนเส้นที่ 1.0 มม.) ต้องตั้ง FRONT_T = 3.0
# 2026-11-12 user: "ตัวอักษรทำเป็นตัวนูน" → พิมพ์ตัวอักษรแยกชิ้น (signbox_letters.stl) แล้วติดกาวลงร่องตื้นที่หน้ากล่อง
#   (ตัวนูนติดกับหน้ากล่องในชิ้นเดียวพิมพ์คว่ำหน้าไม่ได้ — แผ่นหน้าจะลอยเหนือตัวอักษร ต้องใช้ซัพพอร์ตทั้งแผ่น)
RAISED_TEXT = True               # ตัวอักษรนูนแยกชิ้น + ร่องวางตำแหน่งที่หน้ากล่อง
LETTER_T, RECESS, LETTER_FIT = 3.0, 0.2, 0.2   # ตัวอักษรหนา 3.0 · ร่องนำตำแหน่งลึก 0.2 (= 1 ชั้น: ชั้นแรกเว้นรูปโลโก้ไว้ ชั้นสองพิมพ์ทับได้เลย ไม่ต้องสะพานยาว — เดิม 0.4 เพดานร่อง 5,455 มม² ลอย) → นูน 2.8 มม.
FRONT_T = 3.0 if ENGRAVE_TEXT else (1.6 if RAISED_TEXT else 1.2)   # หน้ากล่อง (ตัวนูน: 1.6 เหลือ 1.2 ใต้ร่อง)
SKIN = 1.0                       # ผิวหน้าโปร่งแสงหลังตัวอักษร (พิมพ์สีขาว)
CAP_H = 44.0                     # ความสูงตัวอักษร
TEXT_MAX_W = W - 2 * 14          # ความกว้างตัวอักษรรวมไม่เกิน
LID_T, LIP_H, LIP_T, FIT = 2.4, 8.0, 1.8, 0.3
NOTCH_W, NOTCH_D = 26.0, 12.0    # ร่องสายไฟที่ผนังล่าง (ชิดผนัง) 2 ร่อง: สายไฟดำลงจอ + สาย USB
NOTCH_X = (38.0, 118.0)          # ตำแหน่งกึ่งกลางร่อง วัดจากขอบซ้ายกล่อง
VENT_W, VENT_L, VENT_N = 3.0, 30.0, 7   # ช่องระบายร้อน (ผนังล่าง + ฝาบน)
BR_W, BR_PLATE, BR_T, BR_TONGUE = 30.0, 34.0, 3.0, 28.0   # ขายึด: กว้าง, แผ่นติดผนัง, หนา, ลิ้นเข้ากล่อง
BR_Z = H / 2                     # ระดับขายึด (กึ่งกลางความสูง)
SCREW_Y = D - 14.0               # รูสกรู M3 ที่ผนังข้าง ห่างผนัง 14 มม.


def box(x0, x1, y0, y1, z0, z1):
    return Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])

def to_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=False)

def text_section(text, cap_h, max_w):
    """ตัวอักษร → CrossSection (รวมรูในตัว O/D/A ด้วย EvenOdd) จัดกึ่งกลางที่ (0,0)"""
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    tp = TextPath((0, 0), text, size=100, prop=FontProperties(fname=FONT))
    polys = [np.asarray(p)[:-1] for p in tp.to_polygons() if len(p) > 3]
    allp = np.vstack(polys); (x0, y0), (x1, y1) = allp.min(0), allp.max(0)
    s = min(cap_h / (y1 - y0), max_w / (x1 - x0))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cs = CrossSection([[(float((x - cx) * s), float((y - cy) * s)) for x, y in p] for p in polys], FillRule.EvenOdd)
    return cs, (x1 - x0) * s, (y1 - y0) * s

def logo_pieces(max_w, max_h):
    """อ่านรูปทรงสีแดงจากไฟล์โลโก้ → รายการ CrossSection ทีละชิ้น (ตัวอักษร 5 + ขนปีก 5) ย่อให้พอดี max_w x max_h จัดกึ่งกลาง (0,0)"""
    import fitz
    pg = fitz.open(LOGO_AI)[0]
    shapes = []
    for d in pg.get_drawings():
        f = d.get("fill")
        if not f or min(f) > 0.9: continue           # ข้ามพื้นขาว
        subs, cur = [], []
        def add(x, y):
            if cur and abs(cur[-1][0] - x) < 1e-6 and abs(cur[-1][1] - y) < 1e-6: return
            cur.append((x, y))
        for it in d["items"]:
            if it[0] == "l":
                p0, pts = (it[1].x, it[1].y), [(it[2].x, it[2].y)]
            elif it[0] == "c":
                P = [np.array([q.x, q.y]) for q in it[1:5]]; p0 = (P[0][0], P[0][1])
                pts = [tuple((1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t ** 2 * P[2] + t ** 3 * P[3]) for t in np.linspace(0, 1, 33)[1:]]
            elif it[0] == "re":
                r = it[1]; p0, pts = (r.x0, r.y0), [(r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1), (r.x0, r.y0)]
            else:
                continue
            if cur and (abs(cur[-1][0] - p0[0]) > 1e-3 or abs(cur[-1][1] - p0[1]) > 1e-3):   # เริ่ม subpath ใหม่ (รูในตัว O/D/A)
                subs.append(cur[:]); cur.clear()
            add(*p0)
            for q in pts: add(float(q[0]), float(q[1]))
        if cur: subs.append(cur[:])
        subs = [sp[:-1] if (len(sp) > 3 and abs(sp[0][0] - sp[-1][0]) < 1e-3 and abs(sp[0][1] - sp[-1][1]) < 1e-3) else sp for sp in subs]
        shapes.append([sp for sp in subs if len(sp) >= 3])
    allp = np.vstack([np.asarray(sp) for sh in shapes for sp in sh]); (x0, y0), (x1, y1) = allp.min(0), allp.max(0)
    sc = min(max_w / (x1 - x0), max_h / (y1 - y0)); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # PDF แกน y ชี้ลง → กลับเครื่องหมาย y
    pieces = [CrossSection([[(float((x - cx) * sc), float(-(y - cy) * sc)) for x, y in sp] for sp in sh], FillRule.EvenOdd) for sh in shapes]
    return pieces, (x1 - x0) * sc, (y1 - y0) * sc

def art_section():
    """รูปที่จะนูนบนหน้ากล่อง: โลโก้จากไฟล์ (ถ้ามี) หรือข้อความฟอนต์ → (รวมทั้งหมด, กว้าง, สูง, รายชิ้น, เลื่อนแนวตั้ง)"""
    if os.path.exists(LOGO_AI):
        pieces, w, h = logo_pieces(W - 2 * LOGO_MARGIN_X, H - 2 * LOGO_MARGIN_Y)
        u = pieces[0]
        for q in pieces[1:]: u = u + q
        return u, w, h, pieces, 0.0
    cs, w, h = text_section(TEXT, CAP_H, TEXT_MAX_W)
    return cs, w, h, cs.decompose(), 2.0

# พิกัดกล่อง: X ซ้าย→ขวา (0..W) · Y หน้า→ผนัง (0..D) · Z ล่าง→บน (0..H)
def make_shell():
    front = box(0, W, 0, FRONT_T, 0, H)
    left = box(0, WALL, 0, D, 0, H)
    right = box(W - WALL, W, 0, D, 0, H)
    bottom = box(0, W, 0, D, 0, WALL)
    m = front + left + right + bottom
    # ตัวอักษร: ร่องจากด้านใน (Y = SKIN..FRONT_T) มองจากหน้าอ่านถูกด้าน
    cs, tw, th, _, dz = art_section()
    # extrude ตามแกน Z แล้วหมุนให้ตั้งขึ้น: (x, y_text) → (x, Y, z=y_text) · มองจากหน้ากล่อง (-Y) แกน X ชี้ขวา → ไม่ต้องกลับด้าน
    if RAISED_TEXT and not ENGRAVE_TEXT:   # ร่องตื้นที่ผิวหน้าด้านนอก (Y = 0..RECESS) ไว้วาง/ติดกาวตัวอักษรนูน
        m = m - cs.offset(LETTER_FIT, JoinType.Round).extrude(RECESS + 0.2).rotate([90, 0, 0]).translate([W / 2, RECESS, H / 2 + dz])
    if ENGRAVE_TEXT:
        letters = cs.extrude(FRONT_T - SKIN + 0.2).rotate([90, 0, 0]).translate([W / 2, FRONT_T + 0.2, H / 2 + dz])
        m = m - letters
    # ร่องสายไฟที่ผนังล่าง (เปิดถึงขอบหลัง)
    for cx in NOTCH_X:
        m = m - box(cx - NOTCH_W / 2, cx + NOTCH_W / 2, D - NOTCH_D, D + 1, -1, WALL + 1)
    # ช่องระบายร้อนผนังล่าง (กลางความลึก)
    x_start = W / 2 - (VENT_N - 1) * 9.0 / 2
    for i in range(VENT_N):
        x = x_start + i * 9.0
        m = m - box(x - VENT_W / 2, x + VENT_W / 2, 30, 30 + VENT_L, -1, WALL + 1)
    # รูสกรู M3 ผนังข้าง 2 ด้าน (ขันเข้าลิ้นขายึด)
    hole = Manifold.cylinder(WALL + 2, 1.7, 1.7, 32).rotate([0, 90, 0])
    m = m - hole.translate([-1, SCREW_Y, BR_Z]) - hole.translate([W - WALL - 1, SCREW_Y, BR_Z])
    return m, tw, th

def make_lid():
    """ฝาบน: แผ่นคลุมเต็ม + ขอบเสียบด้านใน 3 ด้าน (ซ้าย/ขวา/หน้า) — พิกัดเดียวกับกล่อง วางที่ Z = H"""
    plate = box(0, W, 0, D, H, H + LID_T)
    xi0, xi1, yi0 = WALL + FIT, W - WALL - FIT, FRONT_T + FIT
    lip = (box(xi0, xi0 + LIP_T, yi0, D - 6, H - LIP_H, H) + box(xi1 - LIP_T, xi1, yi0, D - 6, H - LIP_H, H)
           + box(xi0, xi1, yi0, yi0 + LIP_T, H - LIP_H, H))
    m = plate + lip
    x_start = W / 2 - (VENT_N - 1) * 9.0 / 2
    for i in range(VENT_N):
        x = x_start + i * 9.0
        m = m - box(x - VENT_W / 2, x + VENT_W / 2, 35, 35 + VENT_L, H - 1, H + LID_T + 1)
    return m

def make_bracket(side):
    """ขายึดรูปตัว L: แผ่นแนบผนัง (ระนาบ Y = D) + ลิ้นแนบด้านในผนังข้างกล่อง · side = -1 ซ้าย / +1 ขวา"""
    z0, z1 = BR_Z - BR_W / 2, BR_Z + BR_W / 2
    if side < 0:
        xa, xb = WALL + FIT, WALL + FIT + BR_T                 # ลิ้น
        plate = box(xa, xa + BR_PLATE, D - BR_T, D, z0, z1)
        screw_x = (xa + 12, xa + 26)
    else:
        xb, xa = W - WALL - FIT, W - WALL - FIT - BR_T
        plate = box(xb - BR_PLATE, xb, D - BR_T, D, z0, z1)
        screw_x = (xb - 12, xb - 26)
    tongue = box(xa, xb, D - BR_TONGUE, D, z0, z1)
    m = plate + tongue
    # รูนำสกรู M3 (2.6 มม. ให้เกลียวกัดเนื้อ) ที่ลิ้น ตรงกับรูผนังข้างกล่อง
    m = m - Manifold.cylinder(BR_T + 2, 1.3, 1.3, 32).rotate([0, 90, 0]).translate([xa - 1, SCREW_Y, BR_Z])
    # รูสกรูยึดผนัง 4.2 มม. + บ่าเทเปอร์ (2 รู)
    for sx in screw_x[:1]:
        m = m - Manifold.cylinder(BR_T + 2, 2.1, 2.1, 32).rotate([-90, 0, 0]).translate([sx, D - BR_T - 1, BR_Z])
        m = m - Manifold.cylinder(1.8, 4.2, 2.1, 32).rotate([-90, 0, 0]).translate([sx, D - BR_T - 0.01, BR_Z])
    return m

def make_letters():
    """ตัวอักษรนูนแยกชิ้น วางราบ (หน้าตัวอักษรคว่ำลงเตียง = ผิวเรียบ) — ตัว O/D/A มีรูในตัว เป็นชิ้นเดียวต่อ 1 ตัวอักษร"""
    cs, tw, th, _, _ = art_section()
    return cs.extrude(LETTER_T), tw, th

def plug_ghost():
    """รูปแทนหน้ากากปลั๊ก 120x70 + อะแดปเตอร์/ปลั๊กยื่น 80 มม. (ขอบล่างหน้ากากสูงจากก้นกล่อง ~25)"""
    plate = box(W / 2 - 60, W / 2 + 60, D - 8, D, 25, 95)
    adapter = box(W / 2 - 62, W / 2 - 2, D - 62, D - 8, 30, 88)
    plug = box(W / 2 - 78, W / 2 - 20, D - 80, D - 62, 45, 75)
    return plate + adapter + plug


def make_sticker_files():
    """ไฟล์ตัดสติ๊กเกอร์ขนาดจริง 1:1 จากเส้นโลโก้ต้นฉบับ (เส้นโค้ง bezier จริง ไม่ใช่เส้นหักมุม) — ขนาด/ตำแหน่งเดียวกับชิ้นนูนบนหน้ากล่อง
    sticker_cut_exact.pdf/.svg  = เท่าชิ้นนูนพอดี · sticker_cut_inset.pdf/.svg = หดเข้าข้างละ STICKER_INSET มม. (ขอบสติ๊กเกอร์ไม่ล้นขอบชิ้นงาน ลอกยากกว่า)"""
    import fitz
    STICKER_INSET = 0.3
    RED = (0.886, 0.106, 0.176)
    src = fitz.open(LOGO_AI)[0]
    draws = [d for d in src.get_drawings() if d.get("fill") and min(d["fill"]) <= 0.9]
    # bbox + scale ชุดเดียวกับ logo_pieces (ต้องตรงกับชิ้นนูน)
    pts = []
    for d in draws:
        for it in d["items"]:
            if it[0] == "l": pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
            elif it[0] == "c":
                P = [np.array([q.x, q.y]) for q in it[1:5]]
                pts += [tuple((1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t ** 2 * P[2] + t ** 3 * P[3]) for t in np.linspace(0, 1, 17)]
    A = np.asarray(pts); (x0, y0), (x1, y1) = A.min(0), A.max(0)
    max_w, max_h = W - 2 * LOGO_MARGIN_X, H - 2 * LOGO_MARGIN_Y
    sc = min(max_w / (x1 - x0), max_h / (y1 - y0)); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    PAGE_W, PAGE_H, OX, OY = W + 30.0, H + 46.0, 15.0, 30.0          # หน้ากระดาษ (มม.) + ตำแหน่งมุมซ้ายบนของกรอบหน้ากล่อง
    def mm(x, y):   # พิกัดไฟล์ต้นฉบับ (pt, y ลง) → มม. บนหน้ากระดาษ (y ลง) โดยโลโก้อยู่กลางกรอบหน้ากล่อง
        return (OX + W / 2 + (x - cx) * sc, OY + H / 2 + (y - cy) * sc)
    K = 72 / 25.4
    def subpaths(d):
        """แยก subpath: รายการ [('M',p) ('L',p) ('C',p1,p2,p3)] หน่วย มม."""
        out, cur, last = [], [], None
        for it in d["items"]:
            if it[0] == "l": a, seg = it[1], ("L", mm(it[2].x, it[2].y)); end = it[2]
            elif it[0] == "c": a, seg = it[1], ("C", mm(it[2].x, it[2].y), mm(it[3].x, it[3].y), mm(it[4].x, it[4].y)); end = it[4]
            else: continue
            if last is None or abs(last.x - a.x) > 1e-3 or abs(last.y - a.y) > 1e-3:
                if cur: out.append(cur)
                cur = [("M", mm(a.x, a.y))]
            cur.append(seg); last = end
        if cur: out.append(cur)
        return out
    shapes = [subpaths(d) for d in draws]
    font = r"C:\Windows\Fonts\LeelawUI.ttf"

    def write_pdf(path, shapes_mm, polys_mm, title):
        doc = fitz.open(); pg = doc.new_page(width=PAGE_W * K, height=PAGE_H * K)
        sh = pg.new_shape()
        if shapes_mm is not None:
            for sp_list in shapes_mm:
                for sp in sp_list:
                    cur = None
                    for seg in sp:
                        if seg[0] == "M": cur = fitz.Point(seg[1][0] * K, seg[1][1] * K); start = cur
                        elif seg[0] == "L": q = fitz.Point(seg[1][0] * K, seg[1][1] * K); sh.draw_line(cur, q); cur = q
                        else:
                            q1, q2, q3 = (fitz.Point(v[0] * K, v[1] * K) for v in seg[1:4]); sh.draw_bezier(cur, q1, q2, q3); cur = q3
                    if abs(cur.x - start.x) > 1e-4 or abs(cur.y - start.y) > 1e-4: sh.draw_line(cur, start)
                sh.finish(fill=RED, color=None, even_odd=True, closePath=True)
        else:
            for poly_list in polys_mm:
                for poly in poly_list:
                    P = [fitz.Point(x * K, y * K) for x, y in poly]; sh.draw_polyline(P + [P[0]])
                sh.finish(fill=RED, color=None, even_odd=True, closePath=True)
        # กรอบหน้ากล่อง (อ้างอิง ไม่ต้องตัด) + เส้นวัดขนาด 100 มม.
        sh.draw_rect(fitz.Rect(OX * K, OY * K, (OX + W) * K, (OY + H) * K)); sh.finish(color=(0.55, 0.55, 0.55), width=0.4, dashes="[3 2] 0")
        yb = (OY + H + 8) * K
        sh.draw_line(fitz.Point(OX * K, yb), fitz.Point((OX + 100) * K, yb)); sh.finish(color=(0, 0, 0), width=0.6)
        for xx in (0, 50, 100):
            sh.draw_line(fitz.Point((OX + xx) * K, yb - 3), fitz.Point((OX + xx) * K, yb + 3)); sh.finish(color=(0, 0, 0), width=0.6)
        sh.commit()
        pg.insert_text(fitz.Point(OX * K, 11 * K), title, fontsize=11, fontname="thai", fontfile=font)
        pg.insert_text(fitz.Point(OX * K, 17 * K), "ขนาดจริง 1:1 ห้ามย่อ/ขยาย · โลโก้ %.1f x %.1f มม. · ตัดเฉพาะรูปสีแดง 10 ชิ้น (ปีก 5 + ตัวอักษร 5)" % ((x1 - x0) * sc, (y1 - y0) * sc), fontsize=8.5, fontname="thai", fontfile=font)
        pg.insert_text(fitz.Point(OX * K, 22.5 * K), "เส้นประสีเทา = ขอบหน้ากล่อง %.0f x %.0f มม. (อ้างอิงตำแหน่ง ไม่ต้องตัด) · สีสติ๊กเกอร์: แดง Honda" % (W, H), fontsize=8.5, fontname="thai", fontfile=font)
        pg.insert_text(fitz.Point((OX + 104) * K, yb + 3), "100 มม. (วัดตรวจขนาดก่อนตัด)", fontsize=8, fontname="thai", fontfile=font)
        doc.save(path); doc.close()

    def write_svg(path, shapes_mm, polys_mm):
        ds = []
        if shapes_mm is not None:
            for sp_list in shapes_mm:
                d = ""
                for sp in sp_list:
                    for seg in sp:
                        if seg[0] == "M": d += "M%.3f %.3f " % seg[1]
                        elif seg[0] == "L": d += "L%.3f %.3f " % seg[1]
                        else: d += "C%.3f %.3f %.3f %.3f %.3f %.3f " % (seg[1] + seg[2] + seg[3])
                    d += "Z "
                ds.append(d)
        else:
            for poly_list in polys_mm:
                ds.append(" ".join("M" + " L".join("%.3f %.3f" % (x, y) for x, y in poly) + " Z" for poly in poly_list))
        svg = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<svg xmlns="http://www.w3.org/2000/svg" width="%.1fmm" height="%.1fmm" viewBox="0 0 %.1f %.1f">' % (PAGE_W, PAGE_H, PAGE_W, PAGE_H),
               '<g id="reference-do-not-cut"><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#888" stroke-width="0.15" stroke-dasharray="1.2 0.8"/></g>' % (OX, OY, W, H),
               '<g id="cut" fill="#E21B2D" fill-rule="evenodd" stroke="none">'] + ['<path d="%s"/>' % d.strip() for d in ds] + ['</g>', '</svg>']
        open(path, "w", encoding="utf-8").write("\n".join(svg))

    write_pdf(os.path.join(OUT, "sticker_cut_exact.pdf"), shapes, None, "ไฟล์ตัดสติ๊กเกอร์ โลโก้ HONDA — ขนาดเท่าชิ้นนูนพอดี")
    write_svg(os.path.join(OUT, "sticker_cut_exact.svg"), shapes, None)
    # แบบหดเข้า: ใช้รูปเดียวกับชิ้นนูน (polyline ละเอียด) หดด้วย offset แล้วย้ายเข้าพิกัดหน้ากระดาษ
    pieces, _, _ = logo_pieces(max_w, max_h)
    polys = []
    for pc in pieces:
        ins = pc.offset(-STICKER_INSET, JoinType.Round)
        polys.append([[(OX + W / 2 + float(x), OY + H / 2 - float(y)) for x, y in np.asarray(pl)] for pl in ins.to_polygons()])
    write_pdf(os.path.join(OUT, "sticker_cut_inset.pdf"), None, polys, "ไฟล์ตัดสติ๊กเกอร์ โลโก้ HONDA — หดเข้าข้างละ %.1f มม. (แนะนำ ติดบนชิ้นนูน)" % STICKER_INSET)
    write_svg(os.path.join(OUT, "sticker_cut_inset.svg"), None, polys)
    print("sticker files: sticker_cut_exact.pdf/.svg + sticker_cut_inset.pdf/.svg  (โลโก้ %.1f x %.1f มม. หน้ากระดาษ %.0f x %.0f มม.)" % ((x1 - x0) * sc, (y1 - y0) * sc, PAGE_W, PAGE_H))


def main():
    os.makedirs(OUT, exist_ok=True)
    shell, tw, th = make_shell(); lid = make_lid(); brl, brr = make_bracket(-1), make_bracket(+1)
    for name, m in (("shell", shell), ("lid", lid), ("bracket L", brl), ("bracket R", brr)):
        assert m.volume() > 100 and m.status().name == "NoError", name
    # ---- export ในท่าพิมพ์ ----
    # กล่อง: คว่ำหน้าลง (หน้ากล่อง Y=0 → เตียง Z=0) หมุนรอบ X -90°: (x,y,z) → (x, z, -y)… ใช้ rotate([-90,0,0]) แล้วเลื่อนขึ้น
    shell_p = shell.rotate([90, 0, 0]); b = shell_p.bounding_box(); shell_p = shell_p.translate([-b[0], -b[1], -b[2]])
    lid_p = lid.rotate([180, 0, 0]); b = lid_p.bounding_box(); lid_p = lid_p.translate([-b[0], -b[1], -b[2]])     # แผ่นฝาลงเตียง ขอบเสียบชี้ขึ้น
    br_p = brl.rotate([-90, 0, 0]); b = br_p.bounding_box(); br_p = br_p.translate([-b[0], -b[1], -b[2]])   # -90°: แผ่นติดผนัง (Y=D) ลงเตียง ลิ้นตั้งขึ้น (เดิม +90 ทำแผ่นลอยอยู่บนสุด → Bambu เตือน floating cantilever 2026-11-12)            # แผ่นติดผนังลงเตียง ลิ้นตั้งขึ้น
    to_trimesh(shell_p).export(os.path.join(OUT, "signbox_shell.stl"))
    to_trimesh(lid_p).export(os.path.join(OUT, "signbox_lid.stl"))
    to_trimesh(br_p).export(os.path.join(OUT, "signbox_bracket_x2.stl"))
    if RAISED_TEXT and not ENGRAVE_TEXT:
        let, ltw, lth = make_letters()
        # กลับด้าน (mirror X) ให้หน้าตัวอักษรคว่ำลงเตียง: ผิวหน้าเรียบเงา ด้านที่ติดกาวอยู่บน
        let_p = let.mirror([1, 0, 0]); b = let_p.bounding_box(); let_p = let_p.translate([-b[0], -b[1], -b[2]])
        to_trimesh(let_p).export(os.path.join(OUT, "signbox_letters.stl"))
        print("letters print size %.0f x %.0f x %.1f mm  vol %.1f cm3 (%d ชิ้น) · นูนจากหน้า %.1f มม." % (ltw, lth, LETTER_T, let.volume() / 1000, len(let.decompose()), LETTER_T - RECESS))
    bs = shell_p.bounding_box(); bl = lid_p.bounding_box(); bb = br_p.bounding_box()
    print("shell print size  %.0f x %.0f x %.0f mm  vol %.0f cm3" % (bs[3], bs[4], bs[5], shell.volume() / 1000))
    print("lid print size    %.0f x %.0f x %.0f mm  vol %.0f cm3" % (bl[3], bl[4], bl[5], lid.volume() / 1000))
    print("bracket size      %.0f x %.0f x %.0f mm  vol %.1f cm3 (x2)" % (bb[3], bb[4], bb[5], brl.volume() / 1000))
    if ENGRAVE_TEXT: print("text %s: %.0f x %.0f mm · letter pocket bottom at print z = %.1f mm (เปลี่ยนสีที่ %.1f มม.)" % (TEXT, tw, th, SKIN, SKIN))
    else: print("front face plain %.1f mm (sticker area %.0f x %.0f mm; ตัวอย่างสติ๊กเกอร์ในภาพ %.0f x %.0f มม.)" % (FRONT_T, W, H, tw, th))
    # ตัวอักษรต้องอ่านถูกด้านเมื่อมองจากหน้า: ตรวจว่าขอบซ้ายตัว H (x น้อย) อยู่ซ้ายเมื่อมองจาก -Y → แกน X ไม่กลับ = ถูก
    # ---- preview ----
    spec = importlib.util.spec_from_file_location("w610", os.path.join(os.path.dirname(__file__), "..", "scanner_holder", "make_w610_holder.py"))
    w610 = importlib.util.module_from_spec(spec); spec.loader.exec_module(w610)
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    BODY, LID, BR, GHOST, WHITE = (0.80, 0.10, 0.12), (0.25, 0.25, 0.28), (0.98, 0.62, 0.15), (0.75, 0.75, 0.78), (0.97, 0.97, 0.93)
    if not ENGRAVE_TEXT:   # กล่องขาวล้วน + สติ๊กเกอร์ตัวอักษรสีแดง (ภาพประกอบตำแหน่งสติ๊กเกอร์)
        BODY, LID, WHITE, GHOST = (0.95, 0.95, 0.93), (0.90, 0.90, 0.88), (0.80, 0.10, 0.12), (0.55, 0.55, 0.60)
        if RAISED_TEXT: WHITE = (0.93, 0.12, 0.18) if os.path.exists(LOGO_AI) else (0.99, 0.99, 0.97)   # ภาพตัวอย่าง: โลโก้สีแดงตามไฟล์ (พิมพ์จริงสีขาว ปิดสติ๊กเกอร์/พ่นสีทีหลังได้)
        if False: pass   # ตัวนูนสีขาวเหมือนกล่อง (เส้นขาวอย่างเดียว) — เห็นจากเงา/ขอบ
    # ชั้นผิวขาวด้านหน้า (ไว้โชว์ตัวอักษรขาวในภาพ)
    skin = box(0.5, W - 0.5, -0.3, 0.2, 0.5, H - 0.5)
    cs, _, _, _, dz = art_section()
    glyph = cs.extrude(LETTER_T if (RAISED_TEXT and not ENGRAVE_TEXT) else 0.6).rotate([90, 0, 0]).translate([W / 2, RECESS if (RAISED_TEXT and not ENGRAVE_TEXT) else 0.1, H / 2 + dz])
    face = (box(0, W, -0.5, 0, 0, H) - glyph)
    st, lt, gl = to_trimesh(shell), to_trimesh(lid), to_trimesh(glyph)
    lid_up = to_trimesh(lid.translate([0, 0, 28]))
    views = [
        ("1) ประกอบแล้ว มองจากหน้า — " + ("ตัวอักษร HONDA สีขาวเรืองแสง" if ENGRAVE_TEXT else ("กล่องขาว + โลโก้ปีกนก HONDA นูน 2.8 มม. (พิมพ์แยก ติดกาว)" if RAISED_TEXT else "กล่องขาวเรืองแสง + สติ๊กเกอร์ HONDA (ตัดปิดเอง)")), [(to_trimesh(face), BODY), (gl, WHITE), (st, BODY), (lt, LID)], 118, 14),
        ("2) ยกฝาบน — เข้าถึงปลั๊ก/สาย USB ไฟ LED", [(to_trimesh(face), BODY), (gl, WHITE), (st, BODY), (lid_up, LID), (to_trimesh(plug_ghost()), GHOST)], 142, 34),
        ("3) มองจากด้านหลัง (ฝั่งผนัง) — ขายึดส้ม 2 ตัว + ร่องสายไฟล่าง", [(st, BODY), (lt, LID), (to_trimesh(brl), BR), (to_trimesh(brr), BR), (to_trimesh(plug_ghost()), GHOST)], -62, 20),
        ("4) ท่าพิมพ์: กล่องคว่ำหน้า · ฝา · ขายึด", [(to_trimesh(shell_p), BODY), (to_trimesh(lid_p.translate([W + 15, 0, 0])), LID), (to_trimesh(br_p.translate([W + 15, D + 20, 0])), BR), (to_trimesh(br_p.translate([W + 60, D + 20, 0])), BR)], -55, 30),
    ]
    fig, axs = plt.subplots(2, 2, figsize=(15.2, 12.4), dpi=100)
    for a, (title, ms, az, el) in zip(axs.ravel(), views):
        # render ของ w610 ฉายแบบกลับซ้ายขวา (ทดสอบด้วยลูกบาศก์สี 2026-11-12) → พลิกกลับให้ตัวอักษรอ่านถูก
        a.imshow(w610.render(ms, az, el)[:, ::-1]); a.set_axis_off(); a.set_title(title, fontsize=15, fontname="Leelawadee UI")
    fig.suptitle("กล่องไฟ LED HONDA ครอบปลั๊ก   %.0f x %.0f x %.0f มม. (กว้าง x สูง x ลึก)" % (W, H + LID_T, D), fontsize=18, fontname="Leelawadee UI")
    plt.subplots_adjust(left=0.01, right=0.99, top=0.92, bottom=0.01, wspace=0.02, hspace=0.08)
    fig.savefig(os.path.join(OUT, "signbox_preview.png")); plt.close(fig)
    if os.path.exists(LOGO_AI): make_sticker_files()
    print("written:", OUT)

if __name__ == "__main__":
    main()
