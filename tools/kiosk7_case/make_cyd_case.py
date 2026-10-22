# -*- coding: utf-8 -*-
"""เคสติดผนังสำหรับจุดเบิกอะไหล่จอ 2.8" (CYD ESP32-2432S028) + หัวสแกน GM65 (หน่วย: มิลลิเมตร)

รัน:  python make_cyd_case.py <โฟลเดอร์ปลายทาง>
ได้:  cyd_back.stl (ชิ้นหลัง+ครึ่งหลังคาง) + cyd_front.stl (กรอบหน้า) + cyd_chin.stl (ครึ่งหน้าคาง) — 3 ชิ้น สกรูจากหลัง ทุกชิ้นพิมพ์หน้าแนบแท่นไม่ใช้ support
      cyd_fit_plate.stl (แผ่นลองรูยึด+ขนาดจอ)  cyd_gm65_gauge.stl (ปลอกลองขนาด GM65)  และ preview .png

แกน: X ขวา (มองจากหน้าจอ) · Y ขึ้น · Z ออกจากผนัง (ผนัง z=0) · กึ่งกลางบอร์ด = (0,0)
พิมพ์หลังเคสแนบแท่น ไม่ต้องใช้ support · Bambu A1
ประกอบ: วางบอร์ดลงจากหน้า (จอหันออก) ขันน็อต M3 4 ตัวจากหลังเคสเข้ารูบอร์ด (ใช้นัตฝัง/นัตธรรมดาหน้าบอร์ด หรือสกรูเกลียวปล่อย M3 ยึดเนื้อพลาสติก)
         → GM65 สอดจากหลังคาง หน้าหัวสแกนหันออกและก้มลง GM_TILT → แขวนผนังด้วยรูกุญแจ 2 รู (ผนังปิดช่อง)
ค่าที่ยังเป็นการประมาณ มีเครื่องหมาย [ประมาณ] — แก้ตัวเลขแล้วรันใหม่
"""
import sys, os, math
import numpy as np
from manifold3d import Manifold
import trimesh

# ---------------- บอร์ด CYD ESP32-2432S028 (ค่าทั่วไปของบอร์ดรุ่นนี้ — ยืนยันด้วย cyd_fit_plate) ----------------
PCB_W, PCB_H = 86.0, 50.0      # ขนาด PCB กว้าง x สูง — แผ่นลองตรงพอดี 2026-10-17
HOLE_DX, HOLE_DY = 79.0, 43.0  # ระยะรูยึด 4 มุม — แผ่นลองตรงพอดี 2026-10-17
GLASS_W, GLASS_H = 70.0, 50.0  # [ประมาณ] กระจก+กรอบจอ (ใช้วาด preview)
OPEN_W, OPEN_H = 73.0, 47.0    # ช่องเปิดกรอบหน้า (เผื่อกว้าง, สูงบังขอบกระจกข้างละ 1.5 — พื้นที่แสดงผล 43.2 ยังเห็นครบ)
GLASS_X = 0.0                  # [ประมาณ] กึ่งกลางช่องเปิดเยื้องจากกึ่งกลาง PCB
PCB_T = 1.6
FRONT_H = 7.77 - 1.6           # ผิว PCB → ผิวหน้ากระจก (วัดรวมหลัง PCB→หน้ากระจก 7.77, 2026-10-17)
BACK_H = 5.0                   # [ประมาณ] ผิวหลัง PCB → จุดสูงสุดด้านหลัง (ESP32 module/ช่อง SD ~3.5)
USB_SIDE = 1                   # ช่อง USB/ขั้ว VIN-TX-RX-GND อยู่ด้านขวา (user 2026-10-18 จากรูปประกอบจริง: ให้ย้ายช่องไปขวา) · ปุ่ม BOOT/RST ขอบซ้าย
USB_Y = 2.0                    # [ประมาณ] ตำแหน่งช่อง Type-C วัดจากกึ่งกลาง PCB แนวตั้ง
UART_Y = 14.0                  # [ประมาณ] ช่อง VIN TX RX GND (ข้าง Type-C เหนือขึ้นไป)

# ---------------- GM65 (วัดจริง 2026-10-17) ----------------
GM_W, GM_H, GM_L = 28.0, 13.3, 49.6   # ช่องรับทั้งตัว: กว้าง 28 (ปลอกลอง 31 กว้างไป ~3 มม. 2026-10-17) x สูง 13.3 พอดี x ยาวรวมหัวเสียบสาย 49.6
HEAD_W, HEAD_H, HEAD_D = 20.5, 13.3, 11.7   # หัวสแกนสีดำ (ส่วนที่โผล่ผ่านช่องหน้า) กว้าง x สูง x ลึกถึงแผ่นหู; แผ่นหูกว้าง 27.6 = ตัวหยุดหลังขอบหน้า
GM_TILT = 0.0                         # หัวสแกนหันตรงออกหน้า (2026-10-18: แบบเอียง 45° ประกอบไม่ได้ — ช่องเอียงใส่จากหลังไม่เข้า) ใส่ตัวเครื่องตรง ๆ จากด้านหลังคาง
BASE_T = 4.0                          # [ประมาณ] ความหนาฐานใต้หัวสแกน (PCB+แผ่นยึด) — หัวนั่งอยู่บนฐาน ฐานยื่นต่ำกว่าหัว → ขอบล่างช่องหน้าเป็นตัวหยุดไม่ให้หลุดออกหน้า (user 2026-10-18)
PLUG_ROOM = 9.5                       # ที่ว่างหลังท้ายบอร์ดให้หัวเสียบ JST + สายงอ (พิมพ์รอบ 2026-10-18: ท้ายปิดไม่ได้ ต้องยาวอีก ~2 → +2.5)
GM_FIT = 0.4
LIP_T = 3.0                           # ความหนาขอบหน้าคาง (หัวสแกนโผล่พ้น ~8.7)

# ---------------- ตัวเคส ----------------
FIT = 0.4            # ระยะหลวมรอบ PCB ต่อด้าน
WALL = 2.4
BACK = 3.6           # หนาพอฝังหัวสกรู M3 (2.2) และเซาะร่องสายด้านหลัง (2.0)
BAY = 3.5            # ขยายโพรงด้านขวาเล็กน้อยให้หัวเสียบ JST ของ GM65 ไม่ล้น (user 2026-10-18: โพรงเท่าเดิม, USB เสียบผ่านช่องด้านข้างแบบเคสรอบแรก)
USB_W, USB_H = 25.0, 8.0   # ช่องเสียบ USB-C ผ่านผนังขวา กว้าง 2.5 ซม. (user 2026-10-18) เจาะทะลุผนังชิ้นหลัง
GROOVE_W, GROOVE_D = 12.0, 2.0   # ร่องเดินสายบนผิวหลังเคส (แนบผนัง) จากช่องทะลุในโพรงลงถึงขอบล่าง
PLATE = 1.6          # แผ่นหน้าของชิ้นหน้า (บังขอบ PCB)
TONGUE = 2.0         # ลิ้นประกบชิ้นหน้า-หลัง
STAND = 4.0          # เสารองหลัง PCB (ให้มีที่สำหรับขาบัดกรีด้านหลัง + หัว Type-C)
CHIN_SIDE = 7.0      # เนื้อข้างช่อง GM65 สำหรับสกรูประกบคาง
CHIN_W = GM_W + 2 * GM_FIT + 2 * (WALL + CHIN_SIDE)
KEY_X, KEY_HEAD_D, KEY_SLOT_W, KEY_SLOT_L = 14.0, 9.0, 4.4, 8.0   # รูกุญแจขยับเข้ากลาง (เดิม 28 ทับปุ่ม RESET ฝั่งขวา — user 2026-10-19)
SEG = 48

ix, iy = PCB_W / 2 + FIT, PCB_H / 2 + FIT             # ครึ่งโพรงใน
ox, oy = ix + WALL, iy + WALL
Z_PCB = BACK + max(STAND, BACK_H - 2.0)                # ระดับผิวหลัง PCB (ให้หัว USB-C ต่ำกว่าผิวเคสหลัง)
DZ = Z_PCB + PCB_T + FRONT_H + 0.3 + PLATE + 1.0       # ความลึกเคส: แผ่นหน้าลอยเหนือกระจก 1.3 (user 2026-10-18: back +2, front -1 → รวม +1)
Z_SPLIT = Z_PCB + PCB_T + 0.3 + 2.0                    # ระนาบแบ่งชิ้นหน้า/หลัง (ชิ้นหลังสูงขึ้น 2 ตาม user 2026-10-18)


def box(x0, x1, y0, y1, z0, z1):
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))   # รับลำดับสลับได้ (เช่น USB_SIDE ลบ)
    return Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])

def cyl_z(d, z0, z1, x=0.0, y=0.0):
    return Manifold.cylinder(z1 - z0, d / 2, d / 2, SEG).translate([x, y, z0])

def cyl_x(d, x0, x1, y, z):
    return Manifold.cylinder(x1 - x0, d / 2, d / 2, SEG).rotate([0, 90, 0]).translate([x0, y, z])

def rrect(hx, hy, r, z0, z1):
    cs = Manifold()
    for sx in (-1, 1):
        for sy in (-1, 1):
            cs = cs + Manifold.cylinder(z1 - z0, r, r, SEG * 2).translate([sx * (hx - r), sy * (hy - r), z0])
    return cs.hull()


# ================= เคส 3 ชิ้น (2026-10-18 v3: โพรงขยายฝั่งขวา + สายทุกเส้นออกทางหลัง + คางสแกนตรง) =================
# ชิ้นหลัง (back): แผ่นหลัง + ผนังถึง Z_SPLIT + เสารอง PCB + รูกุญแจ + ช่องสายทะลุหลัง + ร่องสาย + ครึ่งหลังคาง
# ชิ้นหน้า (front): แผ่นหน้าบังขอบ PCB + ผนังจาก Z_SPLIT + ลิ้น + เสารับสกรู   ·   ชิ้นคาง (chin): ครึ่งหน้าคางพร้อมช่องหัวสแกน
# ประกอบ: ชิ้นหน้าคว่ำ → วาง PCB (จอหันลง) เสียบสาย GM65 ที่ขั้ว VIN TX RX GND → ชิ้นคางคว่ำ ใส่ GM65 ตรง ๆ หัวเข้าช่อง
#         → สายออกช่องหลังคาง เดินร่องหลังเข้าช่องทะลุที่โพรงขวา → ครอบชิ้นหลัง → สกรู M3 ×6 จากหลัง
holes = [(sx * HOLE_DX / 2, sy * HOLE_DY / 2) for sx in (-1, 1) for sy in (-1, 1)]
BAY_L = BAY - 1.0                            # 2026-10-19 user: ซ้ายเล็กกว่าขวา 1 มม. ได้ → ขวา 3.5 ซ้าย 2.5 (เปลือกเลื่อนไปขวา 0.5)
XC = USB_SIDE * (BAY - BAY_L) / 2
IX, OX = ix + (BAY + BAY_L) / 2, ox + (BAY + BAY_L) / 2
def shell(hx, hy, r, z0, z1):
    return rrect(hx, hy, r, z0, z1).translate([XC, 0, 0])

# ---- ชิ้นหลัง ----
back = shell(OX, oy, 5.0, 0, Z_SPLIT) - shell(IX, iy, 2.6, BACK, Z_SPLIT + 1)
back = back - (shell(OX - WALL / 2, oy - WALL / 2, 5.0 - WALL / 2, Z_SPLIT - TONGUE, Z_SPLIT + 1) - shell(IX - 0.01, iy - 0.01, 2.6, Z_SPLIT - TONGUE - 1, Z_SPLIT + 2))   # ร่องรับลิ้น
for (hx, hy) in holes:
    back = back + cyl_z(7.5, BACK - 0.1, Z_PCB, hx, hy)
    back = back - cyl_z(3.4, -0.1, Z_PCB + 0.1, hx, hy)          # รูสกรู M3 ทะลุ (สกรูจากหลัง → PCB → เกลียวในเสาชิ้นหน้า)
    back = back - cyl_z(6.4, -0.1, 2.2, hx, hy)                    # ฝังหัวสกรู
# ช่องสายทะลุหลังในโพรงฝั่ง USB (หัว USB-C + สาย GM65 4 เส้น ลอดใต้ขอบ PCB ออกหลัง) + ร่องบนผิวหลังลงถึงขอบล่าง
# ช่องสาย GM65 เข้าโพรง: ช่องทะลุแผ่นหลังที่ขอบล่างกึ่งกลาง (ตรงร่องสายของคาง) — 2026-10-18 ย้ายจากฝั่งขวาเพราะช่อง/ร่องเดิมอยู่ใต้เสารอง PCB ทำให้เสาลอย (Bambu เตือน floating cantilever)
back = back - box(-GROOVE_W / 2, GROOVE_W / 2, -oy - 1, -iy + 6.0, -0.1, BACK + 0.1)
# ช่องเสียบ USB-C = รอยบากเปิดจากขอบประกบของผนังขวา (แบบเคสรอบแรก — วางสายลงก่อนประกบ ชิ้นหน้าปิดด้านบน) กว้าง USB_W ลึกถึงใต้ระดับช่อง USB
# (ผนังขวาจริงอยู่ที่ x = XC+IX .. XC+OX เพราะเปลือกถูกเลื่อน XC — รอบก่อนลืมบวก XC ช่องเลยเจาะไม่ทะลุผนัง)
USB_CUT = box(XC + USB_SIDE * (IX - 0.1), XC + USB_SIDE * (OX + 1), USB_Y - USB_W / 2, USB_Y + USB_W / 2, Z_PCB - USB_H + 0.5, Z_SPLIT + 1)
back = back - USB_CUT
# (ช่องจิ้มปุ่ม BOOT/RST ด้านหลัง — user 2026-10-18 สั่งปิด ไม่เจาะ)
# ช่องระบายอากาศด้านบน
for vx in range(-30, 31, 10):
    back = back - box(vx - 1.2, vx + 1.2, oy - WALL - 1, oy + 1, BACK + 1.5, Z_SPLIT - TONGUE - 0.6)
# รูกุญแจแขวนผนัง
for sx in (-1, 1):
    ky = iy - 8.0
    back = back - cyl_z(KEY_HEAD_D, -0.1, BACK + 0.1, sx * KEY_X, ky)
    back = back - (cyl_z(KEY_SLOT_W, -0.1, BACK + 0.1, sx * KEY_X, ky) + cyl_z(KEY_SLOT_W, -0.1, BACK + 0.1, sx * KEY_X, ky + KEY_SLOT_L)).hull()

# ---- ชิ้นหน้า ----
front = shell(OX, oy, 5.0, Z_SPLIT, DZ) - shell(IX, iy, 2.6, Z_SPLIT - 1, DZ - PLATE)
front = front + (shell(OX - WALL / 2 - 0.15, oy - WALL / 2 - 0.15, 5.0 - WALL / 2, Z_SPLIT - TONGUE, Z_SPLIT + 0.01) - shell(IX, iy, 2.6, Z_SPLIT - TONGUE - 1, Z_SPLIT + 1))   # ลิ้น
front = front - box(XC + USB_SIDE * (IX - 0.2), XC + USB_SIDE * (OX + 1), USB_Y - USB_W / 2 - 0.3, USB_Y + USB_W / 2 + 0.3, Z_SPLIT - TONGUE - 1, Z_SPLIT + 0.02)   # ลิ้นเว้นช่วงช่อง USB
front = front - rrect(OPEN_W / 2, OPEN_H / 2, 2.0, DZ - PLATE - 1, DZ + 1).translate([GLASS_X, 0, 0])   # ช่องกระจก
for (hx, hy) in holes:   # เสารับสกรู: ทรงกระบอกที่รู + เนื้อเชื่อมไปมุมเคส กดบนขอบ PCB รอบรู (บานเกลียวปล่อย 2.7)
    sx, sy = (1 if hx > 0 else -1), (1 if hy > 0 else -1)
    cx_ = XC + sx * IX
    boss = cyl_z(6.4, Z_PCB + PCB_T, DZ - PLATE + 0.01, hx, hy) + box(hx, cx_, hy, sy * iy, Z_PCB + PCB_T, DZ - PLATE + 0.01) + box(hx - 3.2, hx + 3.2, hy, sy * iy, Z_PCB + PCB_T, DZ - PLATE + 0.01) + box(hx, cx_, hy - 3.2, hy + 3.2, Z_PCB + PCB_T, DZ - PLATE + 0.01)
    front = front + boss - cyl_z(2.7, Z_PCB + PCB_T - 0.1, DZ - PLATE - 0.6, hx, hy)

# ---- คาง: ตัวเครื่องตรง (แกนตั้งฉากผนัง) ใส่จากด้านหลังของชิ้นคาง หัวโผล่ช่องหน้า แผ่นหูชนขอบ ----
t = math.radians(GM_TILT)
gw = GM_W / 2 + GM_FIT
GH_TOP = HEAD_H / 2 + GM_FIT               # ช่องเหนือกึ่งกลางหัว
GH_BOT = HEAD_H / 2 + BASE_T + GM_FIT      # ช่องใต้กึ่งกลางหัว (รวมฐาน)
gh = GH_TOP
yb = -oy
BODY_L = GM_L - HEAD_D                                      # ความยาวบอร์ดหลังแผ่นหู
Fz = BODY_L + PLUG_ROOM + BACK + 0.8                        # ระนาบแผ่นหู (z)
chin_z = Fz + LIP_T                                         # ความลึกคาง
Fy = yb - WALL - 2.0 - GH_TOP                               # กึ่งกลางหัวสแกน (y)
chin_bottom = Fy - GH_BOT - 4.0
chin_h = yb - chin_bottom
def gm_local(m):
    return m.rotate([GM_TILT, 0, 0]).translate([0, Fy, Fz])
chin = box(-CHIN_W / 2, CHIN_W / 2, chin_bottom, yb + 2.0, 0, chin_z)
pocket = gm_local(box(-gw, gw, -GH_BOT, GH_TOP, -BODY_L - PLUG_ROOM, 0))         # ช่องตัวเครื่อง (หัว+ฐานใต้หัว) + ที่ว่างหัวเสียบ (ปิดหลังด้วยแผ่นหลังคาง)
# ช่องหน้า: หัวสแกนมี step ~1.5 รอบตัว (พิมพ์รอบแรกดันไม่สุด) → เผื่อ 1.0 ต่อด้าน; แผ่นหูกว้าง 27.6 ยังเป็นตัวหยุด
# ช่องหน้า = เฉพาะหัว (+2.0 ข้าง/บน ให้ขอบ step ผ่าน, ล่าง -1.5) → ฐานใต้หัวหนา BASE_T ชนขอบล่างช่อง = ตัวหยุด ไม่หลุดออกหน้า
window = gm_local(box(-HEAD_W / 2 - 0.3, HEAD_W / 2 + 0.3, -HEAD_H / 2 - 2.5, HEAD_H / 2 - 1.7, -1.0, HEAD_D + 2.0))   # ขอบบนลดลง 2.0 (พิมพ์แล้วด้านบนเหลือ 2 มม. — user 2026-10-18)   # ข้าง/บน กลับไปเท่าช่องเดิม (+0.3) ตาม user 2026-10-18; ขอบล่างคงระดับที่แก้แล้ว (ขอบหยุดฐาน 1.9)
window = window + gm_local(box(-HEAD_W / 2 - 3.0, HEAD_W / 2 + 3.0, -HEAD_H / 2 - 4.0, HEAD_H / 2 + 1.0, LIP_T, HEAD_D + 2.0))
# สาย GM65 ออกทางหลังคาง: ช่องทะลุแผ่นหลังคาง (ตรงที่ว่างหัวเสียบ) + ร่องบนผิวหลังคางไปขอบขวา → เดินตามผนังเข้าร่องของตัวเคส
wire = box(-6.0, 6.0, Fy - GH_BOT, Fy + GH_TOP, -0.1, BACK + PLUG_ROOM)
wire = wire + box(-GROOVE_W / 2, GROOVE_W / 2, Fy, yb + 3.0, -0.1, GROOVE_D)      # ร่องผิวหลังคาง วิ่งขึ้นตรง ๆ ไปชนช่องทะลุที่ขอบล่างเคส
chin_all = chin - pocket - window - wire
chin_mid_y = (chin_bottom + yb) / 2
CHIN_SX = gw + WALL + CHIN_SIDE / 2
chin_back = chin_all ^ box(-100, 100, chin_bottom - 1, yb + 3, -1, Z_SPLIT)
chin_front = chin_all ^ box(-100, 100, chin_bottom - 1, yb, Z_SPLIT, chin_z + 1)     # ชิ้นที่ 3 ตัดเสมอขอบล่างเคส
for sx in (-1, 1):   # สกรูประกบคาง M3 จากหลัง → เกลียวปล่อยในชิ้นคาง
    chin_back = chin_back - cyl_z(3.4, -0.1, Z_SPLIT + 0.1, sx * CHIN_SX, chin_mid_y) - cyl_z(6.4, -0.1, 2.2, sx * CHIN_SX, chin_mid_y)
    chin_front = chin_front - cyl_z(2.7, Z_SPLIT - 0.1, Z_SPLIT + 9.0, sx * CHIN_SX, chin_mid_y)
for sx in (-1, 1):   # ลิ้นคาง
    x0, x1 = sx * (CHIN_W / 2 - WALL), sx * (CHIN_W / 2 - WALL / 2)
    chin_back = chin_back - box(x0, x1, chin_bottom - 1, yb - WALL / 2, Z_SPLIT - TONGUE, Z_SPLIT + 1)
    chin_front = chin_front + box(x0, x1 - sx * 0.15, chin_bottom + 0.15, yb - WALL / 2 - 0.15, Z_SPLIT - TONGUE, Z_SPLIT + 0.01)
back = back + chin_back
body = back + front + chin_front   # รวมไว้ใช้ preview/คำนวณ

# ================= ชิ้นลองขนาด =================
FT = 1.6
fit_plate = rrect(PCB_W / 2, PCB_H / 2, 2.0, 0, FT) - rrect(PCB_W / 2 - 6, PCB_H / 2 - 6, 1.0, -1, FT + 1)
fit_plate = fit_plate + box(-HOLE_DX / 2 - 6, HOLE_DX / 2 + 6, -5, 5, 0, FT) + box(-6, 6, -PCB_H / 2, PCB_H / 2, 0, FT)
for (hx, hy) in holes:
    fit_plate = fit_plate - cyl_z(3.4, -1, FT + 1, hx, hy)
fit_plate = fit_plate - cyl_z(4.0, -1, FT + 1, USB_SIDE * (PCB_W / 2 - 4), USB_Y)      # รูบอกฝั่ง USB
gauge = box(-gw - WALL, gw + WALL, -gh - WALL, gh + WALL, 0, 14.0) - box(-gw, gw, -gh, gh, -1, 15)   # ลองสวมทั้งตัว (บอร์ด+หัว) จากด้านท้าย


def to_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=False)


def _rot(azim, elev):
    a, b = math.radians(azim), math.radians(elev)
    ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    rx = np.array([[1, 0, 0], [0, math.cos(b), -math.sin(b)], [0, math.sin(b), math.cos(b)]])
    return rx @ ry

def render(meshes, azim, elev, size=(760, 640), ss=2):
    W, H = size[0] * ss, size[1] * ss
    R = _rot(azim, elev)
    allv = np.vstack([t.vertices for (t, _c) in meshes]) @ R.T
    lo, hi = allv.min(axis=0), allv.max(axis=0); cen = (lo + hi) / 2
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
            if x1 < x0 or y1 < y0: continue
            X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (py[b] - py[c]) * (px[a] - px[c]) + (px[c] - px[b]) * (py[a] - py[c])
            if abs(d) < 1e-12: continue
            w0 = ((py[b] - py[c]) * (X - px[c]) + (px[c] - px[b]) * (Y - py[c])) / d
            w1 = ((py[c] - py[a]) * (X - px[c]) + (px[a] - px[c]) * (Y - py[c])) / d
            w2 = 1 - w0 - w1; Z = w0 * pz[a] + w1 * pz[b] + w2 * pz[c]
            sub = zbuf[y0:y1 + 1, x0:x1 + 1]
            m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6) & (Z > sub)
            if m.any():
                sub[m] = Z[m]; img[y0:y1 + 1, x0:x1 + 1][m] = np.clip(np.array(color) * shade[k], 0, 1); nbuf[y0:y1 + 1, x0:x1 + 1][m] = n[k]
    edge = np.zeros((H, W), bool)
    for ax_ in (0, 1):
        dn = (nbuf * np.roll(nbuf, 1, axis=ax_)).sum(axis=2); dz = np.abs(zbuf - np.roll(zbuf, 1, axis=ax_))
        both = (zbuf > -1e8) | (np.roll(zbuf, 1, axis=ax_) > -1e8); edge |= both & ((dn < 0.92) | (dz > 2.5))
    for ax_ in (0, 1): edge = edge | np.roll(edge, 1, axis=ax_)
    img[edge] = img[edge] * 0.25
    return img.reshape(size[1], ss, size[0], ss, 3).mean(axis=(1, 3))


def preview(path, tm):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    BODY, CAP, PCB, GLASS, GM = (0.30, 0.52, 0.85), (0.98, 0.62, 0.15), (0.95, 0.55, 0.1), (0.13, 0.13, 0.16), (0.25, 0.8, 0.35)
    pcb_t = to_trimesh(box(-PCB_W / 2, PCB_W / 2, -PCB_H / 2, PCB_H / 2, Z_PCB, Z_PCB + PCB_T))
    glass_t = to_trimesh(box(GLASS_X - GLASS_W / 2, GLASS_X + GLASS_W / 2, -GLASS_H / 2, GLASS_H / 2, Z_PCB + PCB_T, Z_PCB + PCB_T + FRONT_H))
    gm_t = to_trimesh(gm_local(box(-GM_W / 2, GM_W / 2, -HEAD_H / 2 - BASE_T, -HEAD_H / 2, -(GM_L - HEAD_D), 0) + box(-HEAD_W / 2, HEAD_W / 2, -HEAD_H / 2, HEAD_H / 2, -(GM_L - HEAD_D), HEAD_D)))
    FRONT = (0.98, 0.62, 0.15)
    front_up = to_trimesh(front.translate([0, 0, 30])); front_t = to_trimesh(front); chin_t = to_trimesh(chin_front); chin_up = to_trimesh(chin_front.translate([0, 0, 30]))   # ชิ้นในตำแหน่งประกอบ (ไฟล์ STL พลิกไว้พิมพ์)
    CHIN = (0.55, 0.8, 0.3)
    views = [('1) ประกอบเสร็จ — หน้า', [(tm['cyd_back'], BODY), (front_t, FRONT), (chin_t, CHIN), (glass_t, GLASS), (gm_t, GM)], 28, 18),
             ('2) แยกชิ้น — ชิ้นหลัง (ฟ้า) ใส่ PCB + ชิ้นหน้า (ส้ม) + ชิ้นคาง (เขียวอ่อน) ยกขึ้น', [(tm['cyd_back'], BODY), (pcb_t, PCB), (gm_t, GM), (front_up, FRONT), (chin_up, CHIN)], 28, 22),
             ('3) ด้านข้าง (ซ้าย = ผนัง)', [(tm['cyd_back'], BODY), (front_t, FRONT), (chin_t, CHIN), (gm_t, GM)], 90, 0),
             ('4) ด้านหลัง — สกรู 6 ตัว รูกุญแจ ช่องสาย USB', [(tm['cyd_back'], BODY), (front_t, FRONT), (chin_t, CHIN)], 205, 14)]
    fig, axs = plt.subplots(2, 2, figsize=(15.2, 13.4), dpi=100)
    for a, (title, ms, az, el) in zip(axs.ravel(), views):
        a.imshow(render(ms, az, el)); a.set_axis_off(); a.set_title(title, fontsize=15, fontname='Leelawadee UI')
    fig.suptitle('เคสติดผนัง จอ 2.8" + GM65 v3 — 3 ชิ้น  กว้าง %.0f x สูง %.0f x ยื่น %.0f มม.' % (2 * ox + BAY, 2 * oy + chin_h, chin_z), fontsize=17, fontname='Leelawadee UI')
    plt.subplots_adjust(left=0.01, right=0.99, top=0.92, bottom=0.01, wspace=0.02, hspace=0.08)
    fig.savefig(path); plt.close(fig)


def main(out):
    os.makedirs(out, exist_ok=True)
    parts = {'cyd_back': back, 'cyd_front': front.rotate([180, 0, 0]).translate([0, 0, DZ]), 'cyd_chin': chin_front.rotate([180, 0, 0]).translate([0, 0, chin_z]), 'cyd_fit_plate': fit_plate, 'cyd_gm65_gauge': gauge}   # ชิ้นหน้า/คาง พลิกให้หน้าแนบแท่น
    tm = {}
    for name, m in parts.items():
        tt = to_trimesh(m); tm[name] = tt; tt.export(os.path.join(out, name + '.stl'))
        b = tt.bounds
        print('%-16s %6.1f x %6.1f x %5.1f mm | watertight=%s | bodies=%d' % (name, *(b[1] - b[0]), tt.is_watertight, len(m.decompose())))
    print('เคสลึก %.1f | คางลึก %.1f | ระดับ PCB %.1f | คางสูง %.1f | แบ่งชิ้นที่ z=%.1f | สกรู: M3x%.0f ×4 (รู PCB) + M3x%.0f ×2 (คาง)' % (DZ, chin_z, Z_PCB, chin_h, Z_SPLIT, DZ - PLATE - 0.6, Z_SPLIT + 9))
    preview(os.path.join(out, 'cyd_case_preview.png'), tm)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
