# -*- coding: utf-8 -*-
"""เคสติดผนังสำหรับคีออสเบิกอะไหล่ Kiosk7: จอ Waveshare ESP32-S3-Touch-LCD-7 + สแกนนิ้ว AS608 (หน่วย: มิลลิเมตร)

รัน:  python make_kiosk7_case.py <โฟลเดอร์ปลายทาง>
ได้:  kiosk7_body.stl (ตัวเคส+คางสแกนนิ้ว ชิ้นเดียว)  kiosk7_fp_plug.stl (ตัวดันหลังสแกนนิ้ว)  kiosk7_fp_gauge.stl (ปลอกลองขนาดสแกนนิ้ว)
      และรูป kiosk7_case_preview.png

แกน: X = ขวา (มองจากหน้าจอ)  Y = ขึ้น  Z = ออกจากผนัง (ผนัง z=0)  กึ่งกลางกระจก = (0,0)
พิมพ์ตัวเคสโดยหลังเคส (z=0) แนบแท่นพิมพ์ ไม่ต้องใช้ support · เครื่อง Bambu Lab A1 (256x256) ลงได้ชิ้นเดียว
การประกอบ: วางจอลงในเคสจากด้านหน้า → ขันน็อต M3x8 จากหลังเคสเข้าเสาทองเหลือง 4 ต้น → สอดสแกนนิ้วจากใต้คาง
           → ใส่ตัวดัน + น็อต M3x30 ขวางคาง → แขวนผนังด้วยรูกุญแจ 2 รู
ค่าที่ยังเป็นการประมาณ (ยังไม่ได้วัดจริง) มีเครื่องหมาย [ประมาณ] — แก้ตัวเลขแล้วรันใหม่ได้เลย
"""
import sys, os, math
import numpy as np
from manifold3d import Manifold, CrossSection
import trimesh

# ---------------- จอ (ค่าจากแบบทางการ Waveshare ยกเว้นที่ระบุ) ----------------
GLASS_W, GLASS_H = 192.96, 110.76
GLASS_R   = 8.0     # [ประมาณ] รัศมีมุมกระจก
GLASS_T   = 1.21    # C: ความหนากระจกส่วนขอบที่ยื่น (วัดจริง 2026-10-06)
STUD_DX, STUD_DY = 126.20, 65.65   # ระยะห่างเสาทองเหลือง M3
MOD_TOP   = 5.5     # ขอบบนกระจก (ฝั่งสายแพส้ม) → ขอบบนโมดูล LCD — จากรูปเวอร์เนียร์ 2026-10-08: ขอบกระจก→ข้างเสา 21.4 + รัศมีเสา 2.6 = D 24.0 → 24.0 - 18.31 (แผ่นทดสอบรอบแรกใช้ 8.5 แล้วไม่ตรง)
STUD_TOP  = 18.31   # ขอบบนโมดูล → เสาแถวบน
A_STUD    = 19.70   # A: ผิวหน้ากระจก → ผิวบนแผ่นพลาสติกรองหลังจอ (หนา 2.85 ขันบนเสาทองเหลือง — วัดจริง 2026-10-06) เสารับน็อตของเคสกดบนแผ่นนี้ ใช้น็อต M3x12 ทะลุแผ่นเข้าเสา
PLATE_T   = 2.85    # แผ่นพลาสติกรองหลังจอ
B_MAX     = 19.70   # B: จุดสูงสุดด้านหลัง = แผ่นรองหลัง (dongle อยู่ใต้แผ่น)
ROT180    = False   # F: True = บอร์ดกลับหัวจากแบบทางการ (ช่อง USB อยู่ซ้ายเมื่อมองจากหน้าจอ สายแพส้มอยู่ล่าง)

# ---------------- ตัวเคส ----------------
FIT_GLASS = 0.35    # ระยะหลวมรอบกระจก ต่อด้าน
LIP, LEDGE = 1.3, 1.3   # ขอบกันกระจก (นอก) / บ่ารับหลังกระจก (ใน) → ผนังหนา 2.6
BACK      = 2.4     # หลังเคส
BOSS_MIN  = 4.0     # ความสูงขั้นต่ำของเสารับน็อต
STUD_SLOT = 2.0     # รูน็อตเป็นรูยาว +-2 มม. แนวตั้ง เผื่อตำแหน่งเสาคลาด
KEY_X, KEY_HEAD_D, KEY_SLOT_W, KEY_SLOT_L = 40.0, 9.5, 4.6, 9.0   # รูกุญแจแขวนผนัง (หัวสกรูไม่เกิน 8 มม.)
CABLE_W   = 7.0     # ร่องสายไฟออกด้านล่าง
USB_BUMP  = 2.6     # E: user ยืนยัน 2026-10-08 ปลาย dongle ไม่ยื่นเลยขอบกระจก (0) → ผนังข้างฝั่ง USB โป่งออกและเซาะร่องด้านใน (หัวแปลงหนา ~11)
SEG = 48

# ---------------- สแกนนิ้ว AS608 (ตัวเครื่องทรงลิ่ม หน้าแตะนิ้วเอียง ~26 องศา) ----------------
# วางตัวเครื่องตั้งตรง (แกนตัวเครื่องแนวดิ่ง) ในคางหน้าจอ → หน้าแตะนิ้วหงายขึ้นและเอียงมาทางผู้ใช้ด้วยความเอียงของตัวเครื่องเอง
# ค่าจากรูปเวอร์เนียร์ 2026-10-08 (อ่านจากรูป ±0.5) — ยืนยันด้วยปลอกลอง kiosk7_fp_gauge ก่อนพิมพ์ตัวเคส
FP_W      = 20.4    # กว้าง (แนว X) — รูป 402
FP_T      = 24.9    # หนา (แนวลึก Z) — รูป 395
FP_L      = 48.0    # ยาวสุด หน้าถึงท้ายรวม PCB/หัวเสียบ (user แจ้ง 48; ตัวดำอย่างเดียว ~43)
FP_SLANT  = 32.0    # มุมเอียงของหน้าแตะนิ้ว — คำนวณได้ 26 (27.77/24.9) แต่ปลอกลองรอบ 2 ชนด้านสูง (ใกล้ผนัง) ก่อน = หน้าจริงชันกว่า → เพิ่มเป็น 32 (2026-10-08)
FP_GAP    = 9.0     # ที่ว่างใต้ตัวเครื่องให้หัวเสียบ+สายงอ
FP_FIT    = 0.3
FP_LIP    = 1.6     # ความหนาขอบกันตัวเครื่องหลุดขึ้นด้านบน
FP_LIP_W  = 1.8     # ความกว้างขอบกันรอบช่อง (แคบ ให้เห็นหน้าแตะนิ้วเกือบทั้งหน้า)
FP_WALL   = 2.2
CHIN_X    = 45.0    # ตำแหน่งคางสแกนนิ้ว (+ = ขวาเมื่อมองจากหน้าจอ)
CHIN_ZGAP = 1.5     # ช่องสอดตัวเครื่องเริ่มหน้าระนาบกระจกเท่านี้ (ให้ช่องแตะนิ้วพ้นขอบล่างของจอ)
PLUG_BASE = 8.0     # ความยาวฐานตัวดัน (ส่วนที่น็อตขวางร้อยผ่าน)
PLUG_FIT  = 0.25
# ------------------------------------------------

gx, gy = GLASS_W / 2, GLASS_H / 2
ox, oy = gx + FIT_GLASS + LIP, gy + FIT_GLASS + LIP
HIN = max(A_STUD - GLASS_T + BOSS_MIN, B_MAX - GLASS_T + 1.5)   # หลังเคสด้านใน → ระนาบหลังกระจก
BOSS_H = HIN - (A_STUD - GLASS_T)
DZ = BACK + HIN + GLASS_T                                        # ความลึกเคส (ผิวหน้ากระจกเสมอขอบเคส)
Z_LEDGE = BACK + HIN - 0.4                                       # บ่าต่ำกว่าหลังกระจก 0.4 ให้เสาทองเหลืองเป็นตัวรับแรง
USB_SIDE = -1 if ROT180 else 1


def box(x0, x1, y0, y1, z0, z1):
    return Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])

def cyl_z(d, z0, z1, x=0.0, y=0.0):
    return Manifold.cylinder(z1 - z0, d / 2.0, d / 2.0, SEG).translate([x, y, z0])

def cyl_x(d, x0, x1, y, z, seg=SEG):
    return Manifold.cylinder(x1 - x0, d / 2.0, d / 2.0, seg).rotate([0, 90, 0]).translate([x0, y, z])

def rrect(hx, hy, r, z0, z1):
    """แท่งสี่เหลี่ยมมุมมน ครึ่งกว้าง hx ครึ่งสูง hy"""
    cs = Manifold()
    for sx in (-1, 1):
        for sy in (-1, 1):
            cs = cs + Manifold.cylinder(z1 - z0, r, r, SEG * 2).translate([sx * (hx - r), sy * (hy - r), z0])
    return cs.hull()

def stadium_y(d, half, z0, z1, x, y):
    """รูยาวแนวตั้ง (Y) กว้าง d ยาว d + 2*half"""
    return (cyl_z(d, z0, z1, x, y - half) + cyl_z(d, z0, z1, x, y + half)).hull()

def prism_yz(pts, x0, x1):
    """รีดรูปหลายเหลี่ยมในระนาบ (y,z) ไปตามแกน X"""
    m = CrossSection([pts]).extrude(x1 - x0)                # local (x=y_world, y=z_world, z=x_world)
    return m.transform(np.array([[0, 0, 1, x0], [1, 0, 0, 0], [0, 1, 0, 0]], dtype=float))

def board(m):
    """ชิ้นส่วนที่อ้างตำแหน่งบนบอร์ด: หมุน 180 องศาถ้าบอร์ดกลับหัว"""
    return m.rotate([0, 0, 180]) if ROT180 else m


# ================= ตัวเคส =================
body = rrect(ox, oy, GLASS_R + FIT_GLASS + LIP, 0, DZ)
body = body - rrect(gx + FIT_GLASS, gy + FIT_GLASS, GLASS_R + FIT_GLASS, Z_LEDGE, DZ + 1)                 # ร่องวางกระจก
body = body - rrect(gx + FIT_GLASS - LEDGE, gy + FIT_GLASS - LEDGE, max(GLASS_R + FIT_GLASS - LEDGE, 1), BACK, DZ + 1)   # โพรงใน

# เสารับน็อต M3 เข้าเสาทองเหลือง (รูยาวแนวตั้ง + บ่าฝังหัวน็อตจากหลังเคส)
y_up = gy - MOD_TOP - STUD_TOP
studs = [(sx * STUD_DX / 2, yy) for sx in (-1, 1) for yy in (y_up, y_up - STUD_DY)]
CB_DEPTH = BACK + BOSS_H - 3.0      # เหลือเนื้อใต้หัวน็อต 3 มม. → น็อต M3x8 กินเกลียวเสา 5 มม.
add = Manifold(); cut = Manifold()
for (sx, sy) in studs:
    add = add + stadium_y(9.5, STUD_SLOT, BACK - 0.1, BACK + BOSS_H, sx, sy)
    cut = cut + stadium_y(3.4, STUD_SLOT, -0.1, BACK + BOSS_H + 0.1, sx, sy)
    cut = cut + stadium_y(6.6, STUD_SLOT, -0.1, CB_DEPTH, sx, sy)
# ช่องหลังเคสสำหรับเลื่อนสวิตช์ UART1/UART2 + ปุ่ม BOOT/RESET (อยู่ขอบล่างของบอร์ด) [ประมาณจากรูปแบบทางการ]
y_btn = gy - MOD_TOP - 93.0
cut = cut + box(-22, 14, y_btn - 6, y_btn + 6, -0.1, BACK + 0.1)
body = body + board(add) - board(cut)

# ผนังข้างฝั่งช่อง USB: โป่งออกแล้วเซาะร่องด้านใน (dongle ยาวเสมอขอบกระจก)
y_usb = gy - MOD_TOP - 52.4          # กึ่งกลางระหว่างช่อง USB-C 2 ช่อง (44.9 / 59.8 จากขอบบนโมดูล)
bump = box(gx + FIT_GLASS - LEDGE - 0.1, ox + USB_BUMP, y_usb - 22, y_usb + 22, 0, DZ)
pocket = box(gx + FIT_GLASS - LEDGE - 0.1, gx + FIT_GLASS + USB_BUMP - 1.4, y_usb - 20, y_usb + 20, BACK + 1.5, Z_LEDGE - 1.0)
body = body + board(bump) - board(pocket)

# รูกุญแจแขวนผนัง 2 รู (หัวสกรูเข้ารูใหญ่แล้วเลื่อนเคสลง)
for sx in (-1, 1):
    ky = gy - 26.0
    body = body - cyl_z(KEY_HEAD_D, -0.1, BACK + 0.1, sx * KEY_X, ky)
    body = body - (cyl_z(KEY_SLOT_W, -0.1, BACK + 0.1, sx * KEY_X, ky) + cyl_z(KEY_SLOT_W, -0.1, BACK + 0.1, sx * KEY_X, ky + KEY_SLOT_L)).hull()

# ร่องสายไฟออกด้านล่าง (เปิดถึงหลังเคส วางสายก่อนแขวน) ฝั่งเดียวกับช่อง USB
xc = USB_SIDE * 76.0
body = body - box(xc - CABLE_W / 2, xc + CABLE_W / 2, -oy - 1, -gy + 4, -0.1, BACK + 6.0)
# ช่องระบายอากาศ บน/ล่าง
for vx in (-60, -40, -20, 0, 20, 40, 60):
    body = body - box(vx - 1.5, vx + 1.5, oy - LIP - LEDGE - 1, oy + 1, BACK + 4, BACK + 12)
for vx in (-60, -40, -20, 0):
    body = body - box(vx - 1.5, vx + 1.5, -oy - 1, -oy + LIP + LEDGE + 1, BACK + 4, BACK + 12)

# ================= คางสแกนนิ้ว (ตัวเครื่องตั้งตรง สอดจากใต้คาง หน้าแตะนิ้วอยู่ด้านบนคาง เอียงลงมาทางหน้า) =================
yb = -oy
wc, tc = FP_W / 2 + FP_FIT, FP_T / 2 + FP_FIT         # ครึ่งหน้าตัดช่อง (X, Z)
wo = wc + FP_WALL
zp0 = DZ + CHIN_ZGAP                                   # ช่องสอด: หน้าระนาบกระจก
zp1 = zp0 + 2 * tc
zf = zp1 + FP_WALL                                     # หน้าสุดของคาง
tan_s = math.tan(math.radians(FP_SLANT))
y_top_rear = yb - 0.5                                  # ผิวบนคาง (ขอบหลัง ชิดใต้เคส) แล้วลาดลงมาทางหน้า
z_ref = zp0 - FP_WALL
y_bot = y_top_rear - FP_LIP - FP_L - FP_GAP - PLUG_BASE  # ใต้คาง (ช่องสอดเปิดออกทางนี้)

def slab_below(y_at_zref, zref, tilt_deg):
    """ครึ่งปริภูมิใต้ระนาบเอียงรอบแกน X: ผ่านจุด (y_at_zref ที่ z=zref) ลาดลงไปทาง +Z"""
    L = 1000.0
    m = Manifold.cube([L, L, L]).translate([-L / 2, -L, -L / 2])     # ผิวบนที่ y=0
    return m.rotate([tilt_deg, 0, 0]).translate([0, y_at_zref, zref])  # หมุน +tilt รอบ X: ผิวบนลาดลงทาง +Z

chin = box(CHIN_X - wo, CHIN_X + wo, y_bot, yb + 2.0, 0.0, zf) ^ slab_below(y_top_rear, z_ref, FP_SLANT)
# แบบมีขอบกันด้านบน (user เลือก 2026-10-08) — ขอบแคบลงเหลือ FP_LIP_W รอบช่อง ให้กระจกแตะนิ้วโผล่ทั้งหน้า ไม่เหลื่อม
pocket = box(CHIN_X - wc, CHIN_X + wc, y_bot - 1, yb + 5, zp0, zp1) ^ slab_below(y_top_rear - FP_LIP / math.cos(math.radians(FP_SLANT)), z_ref, FP_SLANT)
window = box(CHIN_X - wc + FP_LIP_W, CHIN_X + wc - FP_LIP_W, y_bot + 20, yb + 20, zp0 + FP_LIP_W, zp1 - FP_LIP_W)
y_gap0 = y_bot + PLUG_BASE                             # โซนหัวเสียบ/สายใต้ตัวเครื่อง
# ทางสาย (แก้ 2026-10-09: ของเดิม 9x8 ปิดหลัง หัว Dupont สีดำติด ร้อยไม่ผ่านมุม) → ร่องกว้าง 13 เปิดโล่งด้านหลัง (ผนังเป็นตัวปิด) วางสายจากหลังได้เลย
WIRE_W = 13.0
wire = box(CHIN_X - WIRE_W / 2, CHIN_X + WIRE_W / 2, y_gap0, y_gap0 + FP_GAP + 1.0, -1.0, zp0 + 1)   # ช่องจากใต้ตัวเครื่องถอยถึงผนัง (สูง 10)
wire = wire + box(CHIN_X - WIRE_W / 2, CHIN_X + WIRE_W / 2, y_gap0, -gy + 7.0, -1.0, 12.0)         # ร่องเปิดหลัง ขึ้นเข้าโพรงเคส
Sy, Sz = y_bot + PLUG_BASE / 2, (zp0 + zp1) / 2                                           # น็อต M3x30 ขวางคาง ล็อกตัวดัน
screw = cyl_x(3.4, CHIN_X - wo - 1, CHIN_X + wo + 1, Sy, Sz)
screw = screw + cyl_x(6.4, CHIN_X + wo - 2.4, CHIN_X + wo + 1, Sy, Sz)          # ฝังหัวน็อต (ด้านขวา)
screw = screw + cyl_x(6.6, CHIN_X - wo - 1, CHIN_X - wo + 2.6, Sy, Sz, seg=6)   # ฝังน็อตตัวเมียหกเหลี่ยม (ด้านซ้าย)

body = body + chin
body = body - pocket - window - wire - screw

# ================= ตัวดันใต้สแกนนิ้ว (สอดจากใต้คาง ราง 2 ข้างดันท้ายตัวเครื่องขึ้นชนขอบบน) =================
pw, pt = wc - PLUG_FIT, tc - PLUG_FIT
rail_top = y_top_rear - FP_LIP / math.cos(math.radians(FP_SLANT)) - FP_L + 0.3   # รางดันท้ายตัวเครื่องให้หน้าแตะนิ้วแนบใต้ขอบ (เผื่อกด 0.3)
plug = box(CHIN_X - pw, CHIN_X + pw, y_bot, rail_top, Sz - pt, Sz + pt)
plug = plug - box(CHIN_X - pw + 2.6, CHIN_X + pw - 2.6, y_gap0, y_bot + 100, Sz - pt - 1, Sz + pt + 1)   # เว้นกลางให้หัวเสียบ+สาย
plug = plug - cyl_x(3.6, CHIN_X - wo - 1, CHIN_X + wo + 1, Sy, Sz)

# ================= ปลอกลองขนาดสแกนนิ้ว = ส่วนบนของคาง 16 มม. (พิมพ์ ~10 นาที สวมหัวสแกนนิ้วจากด้านล่าง) =================
gauge = (chin - pocket - window) ^ box(CHIN_X - 50, CHIN_X + 50, y_top_rear - 16.0, yb + 10, z_ref - 1, zf + 1)
gauge = gauge.translate([-CHIN_X, -(y_top_rear - 16.0), -z_ref])

# ================= แผ่นลองตำแหน่งเสาทองเหลือง (พิมพ์ ~20 นาที) =================
# คว่ำจอ วางแผ่นนี้บนปลายเสาทองเหลือง ให้ขอบแผ่นตรงกับขอบกระจก (มองจากด้านบน) แล้วดูว่าเสาอยู่ตรงไหนของรูยาว
# รูกลมเล็ก 1 รู = ด้าน "บน" ของจอตามแบบ (ฝั่งสายแพสีส้ม) ถ้าต้องกลับหัวแผ่นถึงจะตรง = บอร์ดกลับหัว (ROT180)
FT = 1.6
fit_plate = rrect(gx, gy, GLASS_R, 0, FT) - rrect(gx - 7, gy - 7, max(GLASS_R - 7, 1), -1, FT + 1)
for sx in (-1, 1):
    fit_plate = fit_plate + box(sx * STUD_DX / 2 - 6, sx * STUD_DX / 2 + 6, -gy + 1, gy - 1, 0, FT)
fit_plate = fit_plate + box(-STUD_DX / 2, STUD_DX / 2, -4, 4, 0, FT)
for (sx, sy) in studs:
    fit_plate = fit_plate - stadium_y(3.6, 3.0, -1, FT + 1, sx, sy)
fit_plate = fit_plate - cyl_z(4.0, -1, FT + 1, 0, gy - 3.5)


def to_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=False)

def sensor_ghost():
    g = box(CHIN_X - FP_W / 2, CHIN_X + FP_W / 2, y_top_rear - FP_LIP - FP_L, yb + 5, zp0 + FP_FIT, zp1 - FP_FIT)
    return g ^ slab_below(y_top_rear - FP_LIP / math.cos(math.radians(FP_SLANT)) - 0.2, z_ref, FP_SLANT)


def _rot(azim, elev):
    a, b = math.radians(azim), math.radians(elev)
    ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    rx = np.array([[1, 0, 0], [0, math.cos(b), -math.sin(b)], [0, math.sin(b), math.cos(b)]])
    return rx @ ry

def render(meshes, azim, elev, size=(760, 640), ss=2):
    """เรนเดอร์แบบ z-buffer (ฉายขนาน) — กล้องมองจากด้านหน้า (+Z) หมุนรอบแกนตั้ง azim องศา แล้วก้ม elev องศา"""
    W, H = size[0] * ss, size[1] * ss
    R = _rot(azim, elev)
    allv = np.vstack([t.vertices for (t, _c) in meshes]) @ R.T
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    cen = (lo + hi) / 2
    sc = 0.92 * min(W / (hi[0] - lo[0]), H / (hi[1] - lo[1]))
    zbuf = np.full((H, W), -1e9); img = np.ones((H, W, 3)); nbuf = np.zeros((H, W, 3))
    light = np.array([-0.35, 0.55, 0.75]); light /= np.linalg.norm(light)
    for (t, color) in meshes:
        v = t.vertices @ R.T - cen
        px = v[:, 0] * sc + W / 2; py = H / 2 - v[:, 1] * sc; pz = v[:, 2]
        tri = t.faces
        n = np.cross(v[tri[:, 1]] - v[tri[:, 0]], v[tri[:, 2]] - v[tri[:, 0]])
        ln = np.linalg.norm(n, axis=1); ok = (ln > 1e-12) & (n[:, 2] > 0)
        n = n[ok] / ln[ok, None]; tri = tri[ok]
        shade = 0.38 + 0.62 * np.clip(n @ light, 0, 1)
        for k in range(len(tri)):
            a, b, c = tri[k]
            x0, x1 = int(max(0, math.floor(min(px[a], px[b], px[c])))), int(min(W - 1, math.ceil(max(px[a], px[b], px[c]))))
            y0, y1 = int(max(0, math.floor(min(py[a], py[b], py[c])))), int(min(H - 1, math.ceil(max(py[a], py[b], py[c]))))
            if x1 < x0 or y1 < y0:
                continue
            xs = np.arange(x0, x1 + 1) + 0.5; ys = np.arange(y0, y1 + 1) + 0.5
            X, Y = np.meshgrid(xs, ys)
            d = (py[b] - py[c]) * (px[a] - px[c]) + (px[c] - px[b]) * (py[a] - py[c])
            if abs(d) < 1e-12:
                continue
            w0 = ((py[b] - py[c]) * (X - px[c]) + (px[c] - px[b]) * (Y - py[c])) / d
            w1 = ((py[c] - py[a]) * (X - px[c]) + (px[a] - px[c]) * (Y - py[c])) / d
            w2 = 1 - w0 - w1
            Z = w0 * pz[a] + w1 * pz[b] + w2 * pz[c]
            sub = zbuf[y0:y1 + 1, x0:x1 + 1]
            m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6) & (Z > sub)
            if m.any():
                sub[m] = Z[m]
                img[y0:y1 + 1, x0:x1 + 1][m] = np.clip(np.array(color) * shade[k], 0, 1)
                nbuf[y0:y1 + 1, x0:x1 + 1][m] = n[k]
    # เส้นขอบ: ตรงที่ทิศผิวหรือความลึกเปลี่ยนกะทันหัน
    edge = np.zeros((H, W), bool)
    for ax_ in (0, 1):
        dn = (nbuf * np.roll(nbuf, 1, axis=ax_)).sum(axis=2)
        dz = np.abs(zbuf - np.roll(zbuf, 1, axis=ax_))
        both = (zbuf > -1e8) | (np.roll(zbuf, 1, axis=ax_) > -1e8)
        edge |= both & ((dn < 0.92) | (dz > 2.5))
    for ax_ in (0, 1):
        edge = edge | np.roll(edge, 1, axis=ax_)
    img[edge] = img[edge] * 0.25
    return img.reshape(size[1], ss, size[0], ss, 3).mean(axis=(1, 3))


def preview(path, tm):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    BODY, PLUG, GLASS, LCD, SENSOR = (0.30, 0.52, 0.85), (0.98, 0.62, 0.15), (0.13, 0.13, 0.16), (0.55, 0.57, 0.6), (0.25, 0.8, 0.35)
    body_t, plug_t = tm['kiosk7_body'], tm['kiosk7_fp_plug']
    glass_t, lcd_t = to_trimesh(rrect(gx, gy, GLASS_R, DZ - GLASS_T, DZ)), to_trimesh(board(box(-165.72 / 2, 165.72 / 2, gy - MOD_TOP - 97.6, gy - MOD_TOP, DZ - GLASS_T - 5.0, DZ - GLASS_T)))
    sensor_t = to_trimesh(sensor_ghost())
    views = [
        ('1) ประกอบเสร็จ — มองจากด้านหน้า', [(body_t, BODY), (glass_t, GLASS), (sensor_t, SENSOR), (plug_t, PLUG)], 28, 18),
        ('2) ตัวเคสเปล่า — เห็นเสารับน็อต 4 ต้น ช่องระบาย ร่องสาย', [(body_t, BODY)], 28, 18),
        ('3) ด้านข้าง — คางสแกนนิ้ว หน้าแตะนิ้วหงายขึ้นเอียงมาทางหน้า (ซ้าย = ผนัง)', [(body_t, BODY), (glass_t, GLASS), (plug_t, PLUG)], 90, 0),
        ('4) ด้านหลัง — รูกุญแจแขวนผนัง รูน็อต ช่องสวิตช์ และตัวดัน (สีส้ม)', [(body_t, BODY), (plug_t, PLUG)], 205, 14),
    ]
    fig, axs = plt.subplots(2, 2, figsize=(15.2, 13.4), dpi=100)
    for a, (title, ms, az, el) in zip(axs.ravel(), views):
        a.imshow(render(ms, az, el)); a.set_axis_off(); a.set_title(title, fontsize=15, fontname='Leelawadee UI')
    fig.suptitle('เคสติดผนัง Kiosk7 (แบบร่าง — ขนาดยังเป็นค่าประมาณ)   กว้าง %.0f x สูง %.0f x ยื่นจากผนัง %.0f/%.0f มม.' % (2 * ox, oy - y_bot, DZ, zf), fontsize=17, fontname='Leelawadee UI')
    plt.subplots_adjust(left=0.01, right=0.99, top=0.92, bottom=0.01, wspace=0.02, hspace=0.08)
    fig.savefig(path); plt.close(fig)


def main(out):
    os.makedirs(out, exist_ok=True)
    parts = {'kiosk7_body': body, 'kiosk7_fp_plug': plug, 'kiosk7_fp_gauge': gauge, 'kiosk7_fit_plate': fit_plate}
    tm = {}
    for name, m in parts.items():
        t = to_trimesh(m); tm[name] = t
        t.export(os.path.join(out, name + '.stl'))
        b = t.bounds
        print('%-16s %6.1f x %6.1f x %5.1f mm | watertight=%s | bodies=%d | volume %.1f cm3' % (name, *(b[1] - b[0]), t.is_watertight, len(m.decompose()), t.volume / 1000.0))
    print('น็อตยึดจอ M3 ยาว >= %.0f มม. | เคสลึก (ยื่นจากผนัง) %.1f | เสารับน็อตสูง %.1f | คางยาวลงใต้จอ %.1f ยื่นจากผนังสุด %.1f (เลยหน้ากระจก %.1f)' % (3.0 + PLATE_T + 5.0, DZ, BOSS_H, yb - y_bot, zf, zf - DZ))
    preview(os.path.join(out, 'kiosk7_case_preview.png'), tm)
    return tm

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
