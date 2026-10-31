"""
แท่นแขวนผนังสำหรับเครื่องสแกนบาร์โค้ด Worrex W-610 (ทรงปืน) — พิมพ์ 3D ชิ้นเดียว (Bambu Lab A1)

หลักการ (ทิศวางตามที่ user เลือก 2026-10-31): จมูกเครื่องและปุ่มไกหันเข้าผนัง เสียบด้ามจากด้านหน้าเข้าปลอกคอรูปตัว C
หัวนั่งบนแขน จมูกแตะแผ่นที่ยื่นเหนือแขน (ตัวหยุด จึงไม่ดันปุ่มไก) ปลายด้ามโค้งเข้าหาผนังอยู่ในถ้วย ขอบถ้วยด้านหน้ากันด้ามหลุดออกมา

วิธีรัน:  python tools/scanner_holder/make_w610_holder.py "<โฟลเดอร์ผลลัพธ์>"
ผลลัพธ์:  w610_holder.stl (ตัวแท่น), w610_gauge.stl (แหวนทดสอบความพอดีของปลอกคอ พิมพ์ ~5 นาที), w610_holder_preview.png

แกน: X = ซ้าย-ขวา (0 กลางแผ่น), Y = ยื่นออกจากผนัง (0 = ผิวผนัง), Z = ความสูง (0 = ขอบล่างแผ่น)

ขนาดส่วนใหญ่อ่านจากรูปทดลองใส่แท่นที่พิมพ์จริง 2026-10-31 คลาดเคลื่อนได้ราว 5 มม.
"""
import sys, os, math
import numpy as np
from manifold3d import Manifold, CrossSection
import trimesh

# ================= ขนาดเครื่อง (วัดจริงแล้วแก้ที่นี่) =================
GRIP_W = 33.0       # วัดจริง 2026-10-30: ความกว้างด้าม (ซ้าย-ขวา) ใต้หัว
GRIP_D = 40.0       # อ่านจากรูปทดลองใส่ 2026-10-31: หลังด้ามถึงปลายไก (ใช้วาดรูปแทนเครื่อง)
HEAD_W = 67.0       # [ประมาณ] ความกว้างหัวสแกน (ส่วนกว้างสุด) — ต้องกว้างกว่าช่องปลอกคอจึงนั่งบนแขนได้
HEAD_D = 80.0       # อ่านจากรูปทดลองใส่แท่นพิมพ์จริง 2026-10-31
HEAD_H = 36.0       # [ประมาณ] ความหนาหัว
HEAD_FWD = 77.0     # อ่านจากรูปทดลองใส่ 2026-10-31: จมูกเครื่องถึงหลังด้าม ระดับใต้หัว
GRIP_LEN = 105.0    # อ่านจากรูปทดลองใส่แท่นพิมพ์จริง 2026-10-31: ผิวบนแขนถึงปลายด้าม
TIP_REACH = 30.0    # อ่านจากรูปทดลองใส่แท่นพิมพ์จริง 2026-10-31: หลังด้ามถึงปลายด้ามราว 22-27 บวกเผื่อ (ค่าวัด 70 ไม่ตรงกับรูป)

# ================= ค่าออกแบบ =================
CLEAR = 3.0         # ระยะหลวมรอบด้ามต่อด้าน (ปลอกคอไม่ต้องแน่น หัวเป็นตัวรับน้ำหนัก)
PLATE_T = 4.0       # ความหนาแผ่นผนัง
PLATE_W = 64.0      # ความกว้างแผ่นผนัง
PLATE_R = 6.0       # มุมมนแผ่น
ARM_W = 8.0         # ความกว้างแขนปลอกคอ (แต่ละข้าง)
ARM_T = 10.0        # ความหนา (สูง) แขนปลอกคอ
CUP_H = 12.0        # ความสูงขอบถ้วย เหนือพื้นถ้วย (user ขอให้ด้านล่างเล็กลง 2026-10-31)
CUP_T = 3.0         # ความหนาผนังถ้วย
FLOOR_T = 4.0       # ความหนาพื้นถ้วย
TIP_GAP = 6.0       # ปลายด้ามลอยเหนือพื้นถ้วย จึงต่ำกว่าขอบถ้วยราว 6 มม.
SEG = 48

# ค่าที่คำนวณต่อ
PLATE_EXT = 15.0                       # แผ่นยื่นเหนือแขน ให้จมูกเครื่องแตะแทนผนัง
BLOCK_D = 8.0                          # คานขวางยึดโคนแขนกับแผ่น
RIB_H, RIB_D = 30.0, 30.0              # ครีบค้ำใต้แขนแต่ละข้าง สูง x ยาวตามแนวยื่น
Y_BACK = PLATE_T + HEAD_FWD            # ตำแหน่งหลังด้ามเมื่อจมูกแตะแผ่น
OPEN_W = GRIP_W + 2 * CLEAR            # ความกว้างช่องปลอกคอ
Y_CAV0 = PLATE_T + BLOCK_D             # ก้นช่อง ลึกเลยปุ่มไกไปมาก จึงไม่มีอะไรดันไก
Y_CAV1 = Y_BACK + 19.0                 # ปลายแขน ยาวเลยท้ายหัวและยาวกว่าถ้วย (user ขอให้ด้านบนยาวขึ้น 2026-10-31)
OPEN_D = Y_CAV1 - Y_CAV0
Z_FLOOR = FLOOR_T                      # ผิวพื้นถ้วย
Z_ARM1 = Z_FLOOR + TIP_GAP + GRIP_LEN  # ผิวบนแขน (ใต้หัวนั่งตรงนี้)
Z_ARM0 = Z_ARM1 - ARM_T
PLATE_H = Z_ARM1 + PLATE_EXT
# รูกุญแจ 2 รูแนวตั้งกลางแผ่น ระหว่างขอบถ้วยกับคานขวาง (ครีบอยู่ด้านข้างจึงไม่ขวาง)
_KEY_LO = FLOOR_T + CUP_H + 3 + 4.5
_KEY_HI = Z_ARM0 - 3 - 12.3
assert _KEY_HI - _KEY_LO >= 30, "ช่องวางรูกุญแจไม่พอ"
KEYS = [(0.0, _KEY_LO), (0.0, _KEY_HI)]
CUP_IN_W = OPEN_W                      # ถ้วยกว้างเท่าช่องปลอกคอ
CUP_TOP = FLOOR_T + CUP_H              # ความสูงขอบถ้วย
CUP_WALL_H = CUP_T * math.sqrt(2)      # ความหนาผนังหน้าเอียง 45° วัดตามแนว Y
CUP_YF = Y_BACK + 3.0 + CUP_WALL_H - CUP_TOP   # ขอบบนด้านในอยู่เลยหลังด้ามระดับนั้น 3 มม. (ปลายด้ามโค้งเข้าหาผนัง ถ้วยจึงสั้นกว่าแขนได้)
CUP_Y1 = CUP_YF + CUP_TOP                 # ถ้วยยื่นออกจากผนังสุดที่ขอบบน


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
    for kx, kz in KEYS:
        plate = plate - keyhole(kx, kz, -1, PLATE_T + 1)

    # ปลอกคอรูป C: บล็อกหลัง (ตัวเว้นระยะจากแผ่น) + แขน 2 ข้างยื่นไปหน้า ปลายแขนมน
    ow = OPEN_W / 2 + ARM_W
    collar = box(-ow, ow, PLATE_T - 0.5, Y_CAV0, Z_ARM0, Z_ARM1)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * OPEN_W / 2, sx * ow))
        arm = box(x0, x1, Y_CAV0 - 0.5, Y_CAV1 - ARM_W / 2, Z_ARM0, Z_ARM1)
        tip = Manifold.cylinder(ARM_T, ARM_W / 2, ARM_W / 2, SEG).translate([sx * (OPEN_W / 2 + ARM_W / 2), Y_CAV1 - ARM_W / 2, Z_ARM0])
        collar = collar + arm + tip
    # ครีบค้ำใต้แขน 2 ข้าง (ข้างด้าม ไม่ขวางรูกุญแจและตัวด้าม) รูปสามเหลี่ยมพิมพ์ได้โดยไม่ต้อง support
    rib_pts = [(PLATE_T - 0.5, Z_ARM0 + 0.5), (PLATE_T - 0.5, Z_ARM0 - RIB_H), (PLATE_T + RIB_D, Z_ARM0 + 0.5)]
    gusset = prism_yz(rib_pts, -ow, -OPEN_W / 2) + prism_yz(rib_pts, OPEN_W / 2, ow)

    # ถ้วยรับปลายด้าม: พื้น + ผนังข้าง + ผนังหน้าเอียง 45° (เปิดด้านบน)
    # ท่าพิมพ์วางผิวผนังบนฐาน ผนังหน้าเป็น "หลังคา" — ถ้าตั้งฉากจะลอยกลางอากาศ (slicer เตือน floating cantilever 2026-10-30) จึงเอียง 45° ให้แต่ละชั้นต่อจากชั้นก่อน
    cw = CUP_IN_W / 2 + CUP_T
    cup_outer = prism_yz([(PLATE_T - 0.5, 0), (CUP_YF, 0), (CUP_YF + CUP_TOP, CUP_TOP), (PLATE_T - 0.5, CUP_TOP)], -cw, cw)
    zi = CUP_TOP + 1.0
    cup_inner = prism_yz([(PLATE_T, Z_FLOOR), (CUP_YF + Z_FLOOR - CUP_WALL_H, Z_FLOOR), (CUP_YF + zi - CUP_WALL_H, zi), (PLATE_T, zi)], -CUP_IN_W / 2, CUP_IN_W / 2)
    cup = cup_outer - cup_inner
    # ร่องระบายน้ำ/ฝุ่นกลางพื้นถ้วย ปลายแหลม 45° พิมพ์ได้โดยไม่ต้อง support
    y0, y1 = PLATE_T + 6, CUP_YF - 6
    cup = cup - CrossSection([[(-4, y0), (4, y0), (4, y1 - 4), (0, y1), (-4, y1 - 4)]]).extrude(Z_FLOOR + 2).translate([0, 0, -1])

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
    """รูปแทนเครื่องสแกนวางในแท่น: จมูกแตะแผ่นเหนือแขน ปุ่มไกและปลายด้ามหันเข้าผนัง"""
    z0 = Z_ARM1 + 0.5
    head = box(-HEAD_W / 2, HEAD_W / 2, Y_BACK - HEAD_FWD, Y_BACK - HEAD_FWD + HEAD_D, z0, z0 + HEAD_H)
    grip = box(-GRIP_W / 2, GRIP_W / 2, Y_BACK - GRIP_D + 8, Y_BACK, z0 - GRIP_LEN + 20, z0)
    trig = box(-GRIP_W / 2 + 4, GRIP_W / 2 - 4, Y_BACK - GRIP_D, Y_BACK - GRIP_D + 8, z0 - 30, z0 - 4)
    tip = box(-GRIP_W / 2, GRIP_W / 2, Y_BACK - TIP_REACH, Y_BACK - 8, z0 - GRIP_LEN, z0 - GRIP_LEN + 20)
    return head + grip + trig + tip

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
        ('1) ใส่เครื่องแล้ว — สีเทาคือรูปแทนเครื่อง จมูกหันเข้าผนัง', [(holder_t, BODY), (ghost_t, GHOST)], -30, 18),
        ('2) แท่นเปล่า — แขนรูปตัว C ครีบค้ำ 2 ข้าง และถ้วยรับปลายด้าม', [(holder_t, BODY)], -30, 18),
        ('3) ด้านข้าง (ซ้าย = ผนัง) — จมูกแตะแผ่น หัวนั่งบนแขน ปลายด้ามอยู่ในถ้วย', [(holder_t, BODY), (ghost_t, GHOST)], -90, 0),
        ('4) แหวนทดสอบ (สีส้ม) — สอดด้ามใต้หัวเข้าช่อง หัวต้องนั่งบนแขน ก่อนพิมพ์ตัวจริง', [(gauge_t, GAUGE)], -20, 40),
    ]
    fig, axs = plt.subplots(2, 2, figsize=(15.2, 13.4), dpi=100)
    for a, (title, ms, az, el) in zip(axs.ravel(), views):
        a.imshow(render(ms, az, el)); a.set_axis_off(); a.set_title(title, fontsize=15, fontname='Leelawadee UI')
    b = holder_t.bounds
    fig.suptitle('แท่นแขวนผนัง Worrex W-610 (ปรับตามรูปทดลองใส่ · สีเทาเป็นรูปแทนเครื่อง)   กว้าง %.0f x สูง %.0f x ยื่นจากผนัง %.0f มม.' % (b[1][0] - b[0][0], b[1][2] - b[0][2], b[1][1] - b[0][1]), fontsize=17, fontname='Leelawadee UI')
    plt.subplots_adjust(left=0.01, right=0.99, top=0.92, bottom=0.01, wspace=0.02, hspace=0.08)
    fig.savefig(path); plt.close(fig)


def main(out):
    os.makedirs(out, exist_ok=True)
    holder, gauge = build()
    tm = {}
    for name, m in (('w610_holder', holder), ('w610_gauge', gauge)):
        t = to_trimesh(m); tm[name] = t
        # ตัวแท่นหมุนเป็นท่าพิมพ์ให้แล้ว: ผิวที่ชนผนังราบบนฐาน เปิดใน slicer แล้วสั่งพิมพ์ได้เลย ไม่ต้องเปิด support
        to_trimesh(m.rotate([90, 0, 0]) if name == 'w610_holder' else m).export(os.path.join(out, name + '.stl'))
        b = t.bounds
        print('%-12s %6.1f x %6.1f x %5.1f mm (กว้าง x ยื่นจากผนัง x สูง) | watertight=%s | bodies=%d | volume %.1f cm3' % (name, *(b[1] - b[0]), t.is_watertight, len(m.decompose()), t.volume / 1000.0))
    print('ช่องปลอกคอ กว้าง %.1f ลึก %.1f | แขนบน Z=%.1f | พื้นถ้วย Z=%.1f | ถ้วยยื่น %.1f | รูกุญแจ (x, สูงจากขอบล่าง) %s' % (
        OPEN_W, OPEN_D, Z_ARM1, Z_FLOOR, CUP_Y1, KEYS))
    preview(os.path.join(out, 'w610_holder_preview.png'), tm['w610_holder'], tm['w610_gauge'])
    return tm

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
