"""
แท่นแขวนผนังสำหรับเครื่องสแกนบาร์โค้ด Worrex W-610 (ทรงปืน) — พิมพ์ 3D ชิ้นเดียว (Bambu Lab A1)

หลักการ: เสียบด้ามจากด้านหน้าเข้า "ปลอกคอ" รูปตัว C ที่ยื่นออกจากแผ่นผนัง หัวสแกนเนอร์ (กว้างกว่าด้าม)
นั่งบนแขนปลอกคอ ปลายด้ามลงไปอยู่ใน "ถ้วยรับ" ด้านล่างกันแกว่ง/กันหลุด หัวหันออกจากผนัง (นอนราบ) เอาออกโดยยกขึ้นแล้วดึงมาด้านหน้า

วิธีรัน:  python tools/scanner_holder/make_w610_holder.py "<โฟลเดอร์ผลลัพธ์>"
ผลลัพธ์:  w610_holder.stl (ตัวแท่น), w610_gauge.stl (แหวนทดสอบความพอดีของปลอกคอ พิมพ์ ~5 นาที), w610_holder_preview.png

แกน: X = ซ้าย-ขวา (0 กลางแผ่น), Y = ยื่นออกจากผนัง (0 = ผิวผนัง), Z = ความสูง (0 = ขอบล่างแผ่น)

⚠️ ขนาดเครื่องสแกน [ประมาณ] จากรูปสินค้า/รุ่นทรงเดียวกัน — ก่อนพิมพ์ตัวจริงให้วัดด้วยเวอร์เนียแล้วแก้ค่าในกลุ่ม "ขนาดเครื่อง" ด้านล่าง
หรือพิมพ์ w610_gauge.stl ก่อน (สอดด้ามใต้หัวเข้าช่อง ถ้าหลวม/คับให้ปรับ GRIP_W / GRIP_D)
"""
import sys, os, math
import numpy as np
from manifold3d import Manifold, CrossSection
import trimesh

# ================= ขนาดเครื่อง (วัดจริงแล้วแก้ที่นี่) =================
GRIP_W = 33.0       # [ประมาณ] ความกว้างด้าม (ซ้าย-ขวา) วัดใต้หัวประมาณ 2 ซม.
GRIP_D = 46.0       # [ประมาณ] ความหนาด้ามหน้า-หลัง ใต้หัว **รวมปุ่มไก** (ด้านหลังด้าม → ปลายไก)
HEAD_W = 67.0       # [ประมาณ] ความกว้างหัวสแกน (ส่วนกว้างสุด) — ต้องกว้างกว่าช่องปลอกคอจึงนั่งบนแขนได้
HEAD_D = 90.0       # [ประมาณ] ความยาวหัว จากจมูก (ช่องยิง) ถึงท้ายหัว
HEAD_H = 36.0       # [ประมาณ] ความหนาหัว
HEAD_BACK = 22.0    # [ประมาณ] ท้ายหัวยื่นเลยหลังด้ามเท่าไร (ด้ามอยู่ค่อนไปทางหน้าของหัว)
GRIP_LEN = 130.0    # [ประมาณ] ความยาวด้าม จากใต้หัวถึงปลายด้าม
GRIP_TIP_D = 50.0   # [ประมาณ] ปลายด้ามบานออก กว้างสุด (หน้า-หลัง) — ใช้กำหนดความลึกถ้วยรับ

# ================= ค่าออกแบบ =================
CLEAR = 3.0         # ระยะหลวมรอบด้ามต่อด้าน (ปลอกคอไม่ต้องแน่น หัวเป็นตัวรับน้ำหนัก)
PLATE_T = 4.0       # ความหนาแผ่นผนัง
PLATE_W = 64.0      # ความกว้างแผ่นผนัง
PLATE_R = 6.0       # มุมมนแผ่น
ARM_W = 8.0         # ความกว้างแขนปลอกคอ (แต่ละข้าง)
ARM_T = 10.0        # ความหนา (สูง) แขนปลอกคอ
CUP_H = 16.0        # ความสูงขอบถ้วยรับปลายด้าม
CUP_T = 3.0         # ความหนาผนังถ้วย
FLOOR_T = 4.0       # ความหนาพื้นถ้วย
TIP_GAP = 10.0      # เผื่อปลายด้ามลอยเหนือพื้นถ้วย (ถ้าด้ามยาวกว่าที่ประมาณ ปลายจะไปนั่งบนพื้นถ้วยแทน ใช้ได้ทั้งสองแบบ)
SEG = 48

# ค่าที่คำนวณต่อ
OPEN_W = GRIP_W + 2 * CLEAR            # ความกว้างช่องปลอกคอ (ด้ามสอดเข้าจากหน้า)
OPEN_D = GRIP_D + 2 * CLEAR            # ความลึกช่องปลอกคอ (หน้า-หลัง)
Y_CAV0 = PLATE_T + HEAD_BACK + CLEAR   # ผนังหลังของช่อง (เว้นที่ให้ท้ายหัวไม่ชนแผ่น)
Y_CAV1 = Y_CAV0 + OPEN_D               # ปลายแขน (ด้านหน้า)
Z_FLOOR = FLOOR_T                      # ผิวพื้นถ้วย
Z_ARM1 = Z_FLOOR + TIP_GAP + GRIP_LEN  # ผิวบนแขน (ใต้หัวนั่งตรงนี้)
Z_ARM0 = Z_ARM1 - ARM_T
PLATE_H = Z_ARM1                       # แผ่นจบเสมอผิวบนแขน (ไม่มีแผ่นอยู่หลังหัว → ท้ายหัวยื่นเท่าไรก็ไม่ชน)
GUS_H = 26.0                           # ความสูงค้ำยันใต้บล็อกปลอกคอ
Z_KEY_TOP = Z_ARM0 - GUS_H - 18.0      # รูกุญแจบน อยู่ใต้ค้ำยัน
Z_KEY_BOT = FLOOR_T + CUP_H + 14.0     # รูกุญแจล่าง อยู่เหนือถ้วย
CUP_IN_W = OPEN_W + 12.0               # ถ้วยกว้างกว่าช่องปลอกคอ (ปลายด้ามบาน)
CUP_Y1 = PLATE_T + HEAD_BACK + GRIP_TIP_D + CLEAR + 4.0   # ถ้วยยื่นออกจากผนัง


def box(x0, x1, y0, y1, z0, z1):
    return Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])

def cyl_y(d, y0, y1, x, z, seg=SEG):
    return Manifold.cylinder(y1 - y0, d / 2.0, d / 2.0, seg).rotate([-90, 0, 0]).translate([x, y0, z])

def rrect_xz(x0, x1, z0, z1, r, y0, y1):
    """แผ่นสี่เหลี่ยมมุมมนในระนาบ X-Z หนาตามแกน Y"""
    m = Manifold()
    for x in (x0 + r, x1 - r):
        for z in (z0 + r, z1 - r):
            m = m + cyl_y(2 * r, y0, y1, x, z)
    return m.hull()

def keyhole(x, z, y0, y1, head=9.0, slot=4.6, length=10.0):
    """รูกุญแจแขวนน็อต: รูใหญ่ด้านล่าง ร่องยาวขึ้นบน"""
    return cyl_y(head, y0, y1, x, z) + box(x - slot / 2, x + slot / 2, y0, y1, z, z + length) + cyl_y(slot, y0, y1, x, z + length)

def prism_yz(pts, x0, x1):
    m = CrossSection([pts]).extrude(x1 - x0)
    return m.transform(np.array([[0, 0, 1, x0], [1, 0, 0, 0], [0, 1, 0, 0]], dtype=float))


def build():
    hw = PLATE_W / 2
    plate = rrect_xz(-hw, hw, 0, PLATE_H, PLATE_R, 0, PLATE_T)
    plate = plate - keyhole(0, Z_KEY_TOP, -1, PLATE_T + 1) - keyhole(0, Z_KEY_BOT, -1, PLATE_T + 1)

    # ปลอกคอรูป C: บล็อกหลัง (ตัวเว้นระยะจากแผ่น) + แขน 2 ข้างยื่นไปหน้า ปลายแขนมน
    ow = OPEN_W / 2 + ARM_W
    collar = box(-ow, ow, PLATE_T - 0.5, Y_CAV0, Z_ARM0, Z_ARM1)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * OPEN_W / 2, sx * ow))
        arm = box(x0, x1, Y_CAV0 - 0.5, Y_CAV1 - ARM_W / 2, Z_ARM0, Z_ARM1)
        tip = Manifold.cylinder(ARM_T, ARM_W / 2, ARM_W / 2, SEG).translate([sx * (OPEN_W / 2 + ARM_W / 2), Y_CAV1 - ARM_W / 2, Z_ARM0])
        collar = collar + arm + tip
    # ค้ำยันใต้บล็อกหลัง (สามเหลี่ยม) รับน้ำหนักหัว
    gusset = prism_yz([(PLATE_T - 0.5, Z_ARM0 + 0.5), (PLATE_T - 0.5, Z_ARM0 - GUS_H), (Y_CAV0, Z_ARM0 + 0.5)], -ow, ow)   # เรียงทวนเข็ม (manifold ไม่รับตามเข็ม)

    # ถ้วยรับปลายด้าม: พื้น + ขอบหน้า/ข้าง (เปิดด้านบน) มุมหน้ามน
    cw = CUP_IN_W / 2 + CUP_T
    rc = 6.0
    cup_outer = box(-cw, cw, PLATE_T - 0.5, CUP_Y1 - rc, 0, Z_FLOOR + CUP_H)
    for sx in (-1, 1):
        cup_outer = cup_outer + Manifold.cylinder(Z_FLOOR + CUP_H, rc, rc, SEG).translate([sx * (cw - rc), CUP_Y1 - rc, 0])
    cup_outer = cup_outer.hull()
    cup_inner = box(-CUP_IN_W / 2, CUP_IN_W / 2, PLATE_T, CUP_Y1 - CUP_T, Z_FLOOR, Z_FLOOR + CUP_H + 1)
    cup = cup_outer - cup_inner
    # ร่องระบายน้ำ/ฝุ่นกลางพื้นถ้วย
    cup = cup - box(-4, 4, PLATE_T + 6, CUP_Y1 - CUP_T - 6, -1, Z_FLOOR + 1)

    holder = plate + collar + gusset + cup

    # แหวนทดสอบ: ปลอกคออย่างเดียว บาง 4 มม. (เช็คว่าด้ามสอดช่องได้และหัวนั่งบนแขน)
    gauge = (collar.translate([0, -(PLATE_T - 0.5), -Z_ARM0]))
    gauge = gauge ^ box(-100, 100, -100, 100, 0, 4.0)
    return holder, gauge


# ================= preview =================
def to_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=False)

def scanner_ghost():
    """รูปแทนเครื่องสแกน (หัว + ด้าม) วางในแท่น เพื่อดูตำแหน่ง"""
    yc = Y_CAV0 + CLEAR            # หลังด้ามชิดผนังหลังช่อง (เว้น CLEAR)
    head = box(-HEAD_W / 2, HEAD_W / 2, yc - HEAD_BACK, yc - HEAD_BACK + HEAD_D, Z_ARM1 + 0.5, Z_ARM1 + 0.5 + HEAD_H)
    grip = box(-GRIP_W / 2, GRIP_W / 2, yc, yc + GRIP_D - 8, Z_ARM1 + 0.5 - GRIP_LEN, Z_ARM1 + 0.5)
    trig = box(-GRIP_W / 2 + 4, GRIP_W / 2 - 4, yc + GRIP_D - 8, yc + GRIP_D, Z_ARM1 - 30, Z_ARM1 - 4)
    return head + grip + trig

def _rot(azim, elev):
    a, b = math.radians(azim), math.radians(elev)
    ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    rx = np.array([[1, 0, 0], [0, math.cos(b), -math.sin(b)], [0, math.sin(b), math.cos(b)]])
    return rx @ ry

def render(meshes, azim, elev, size=(760, 640), ss=2):
    """z-buffer ฉายขนาน — กล้องมองจาก +Y (หน้าแท่น) หมุนรอบแกน Z ด้วย azim แล้วก้ม elev; พิกัดจอ: X ขวา, Z ขึ้น"""
    W, H = size[0] * ss, size[1] * ss
    R = _rot(azim, elev)
    swap = np.array([[1, 0, 0], [0, 0, 1], [0, 1, 0]], dtype=float)   # (x, y_out, z_up) → (x, z_up, y_toward_camera)
    allv = np.vstack([t.vertices for (t, _c) in meshes]) @ swap.T @ R.T
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    cen = (lo + hi) / 2
    sc = 0.92 * min(W / (hi[0] - lo[0]), H / (hi[1] - lo[1]))
    zbuf = np.full((H, W), -1e9); img = np.ones((H, W, 3)); nbuf = np.zeros((H, W, 3))
    light = np.array([-0.35, 0.55, 0.75]); light /= np.linalg.norm(light)
    for (t, color) in meshes:
        v = t.vertices @ swap.T @ R.T - cen
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

def preview(path, holder_t, gauge_t):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    BODY, GHOST, GAUGE = (0.30, 0.52, 0.85), (0.35, 0.35, 0.38), (0.98, 0.62, 0.15)
    ghost_t = to_trimesh(scanner_ghost())
    views = [
        ('1) ใส่เครื่องแล้ว — มองเฉียงหน้า (สีเทา = เครื่องสแกน หัวหันออกจากผนัง)', [(holder_t, BODY), (ghost_t, GHOST)], -30, 18),
        ('2) แท่นเปล่า — ปลอกคอรูป C ด้านบน + ถ้วยรับปลายด้ามด้านล่าง', [(holder_t, BODY)], -30, 18),
        ('3) ด้านข้าง (ซ้าย = ผนัง) — หัวนั่งบนแขน ปลายด้ามอยู่ในถ้วย', [(holder_t, BODY), (ghost_t, GHOST)], -90, 0),
        ('4) แหวนทดสอบ (สีส้ม) — สอดด้ามใต้หัวเข้าช่อง หัวต้องนั่งบนแขน ก่อนพิมพ์ตัวจริง', [(gauge_t, GAUGE)], -20, 40),
    ]
    fig, axs = plt.subplots(2, 2, figsize=(15.2, 13.4), dpi=100)
    for a, (title, ms, az, el) in zip(axs.ravel(), views):
        a.imshow(render(ms, az, el)); a.set_axis_off(); a.set_title(title, fontsize=15, fontname='Leelawadee UI')
    b = holder_t.bounds
    fig.suptitle('แท่นแขวนผนัง Worrex W-610 (แบบร่าง — ขนาดเครื่องเป็นค่าประมาณ)   กว้าง %.0f x สูง %.0f x ยื่นจากผนัง %.0f มม.' % (b[1][0] - b[0][0], b[1][2] - b[0][2], b[1][1] - b[0][1]), fontsize=17, fontname='Leelawadee UI')
    plt.subplots_adjust(left=0.01, right=0.99, top=0.92, bottom=0.01, wspace=0.02, hspace=0.08)
    fig.savefig(path); plt.close(fig)


def main(out):
    os.makedirs(out, exist_ok=True)
    holder, gauge = build()
    tm = {}
    for name, m in (('w610_holder', holder), ('w610_gauge', gauge)):
        t = to_trimesh(m); tm[name] = t
        t.export(os.path.join(out, name + '.stl'))
        b = t.bounds
        print('%-12s %6.1f x %6.1f x %5.1f mm (กว้าง x ยื่นจากผนัง x สูง) | watertight=%s | bodies=%d | volume %.1f cm3' % (name, *(b[1] - b[0]), t.is_watertight, len(m.decompose()), t.volume / 1000.0))
    print('ช่องปลอกคอ กว้าง %.1f ลึก %.1f | แขนบน Z=%.1f | พื้นถ้วย Z=%.1f | ถ้วยยื่น %.1f | รูกุญแจ 2 รู ห่างกัน %.1f มม. (น็อตหัว 4 มม. ก้าน 4.6)' % (
        OPEN_W, OPEN_D, Z_ARM1, Z_FLOOR, CUP_Y1, Z_KEY_TOP - Z_KEY_BOT))
    preview(os.path.join(out, 'w610_holder_preview.png'), tm['w610_holder'], tm['w610_gauge'])
    return tm

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
