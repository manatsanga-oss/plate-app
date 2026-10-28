#!/usr/bin/env python3
# platewatch — รันบน Raspberry Pi (shoppi) ที่ร้าน ป.เปา
# ดึง snapshot จาก NVR Dahua (CGI snapshot.cgi) ทุก N วินาที แล้วเฝ้า "โซน" (เช่น ลิฟต์ซ่อม CH6 ซ้าย/ขวา) ด้วยการเทียบภาพ:
#   - motion: โซนเปลี่ยนจากเฟรมก่อน → ยังไม่นิ่ง
#   - เมื่อโซนนิ่งครบ stable_sec และต่างจาก "สภาพล่าสุดที่รายงานไป" เกิน change_thr → สภาพใหม่ (รถเข้า/ออก/เปลี่ยนคัน)
#     → ส่งภาพโซนไป n8n service-queue-api (vehicle_arrived) 1 ครั้ง — n8n เทียบกับคันก่อน + อ่านทะเบียนด้วย GPT + บันทึก + แจ้ง LINE (เฉพาะอ่านทะเบียนได้)
# เหตุผลที่ไม่ใช้ YOLO: มุมกล้องมองจากบนลงท้ายรถ COCO yolov8n/s จับมอเตอร์ไซค์บนลิฟต์ไม่ได้ (ทดสอบ 2026-10-26) — AI ฝั่ง n8n ตัดสินแทน (ต่อ "สภาพใหม่" ครั้งเดียว ถูกกว่าโพลล์)
# config: ~/nvr/platewatch.json · รหัส NVR: ~/nvr/.pw (ไม่อยู่ใน repo) · log: journalctl -u platewatch -f · ภาพล่าสุด: ~/nvr/last_<channel>.jpg
import os, sys, time, json, base64, logging, traceback
import requests
from requests.auth import HTTPDigestAuth
import numpy as np
import cv2

HOME = os.path.expanduser('~')
UPSCALE_MIN = 1800   # ด้านยาวขั้นต่ำของภาพที่ส่ง (ขยายแบบ cubic ถ้าเล็กกว่านี้)
CFG_PATH = os.path.join(HOME, 'nvr', 'platewatch.json')
DEFAULT = {
    'nvr_host': '192.168.1.100', 'nvr_user': 'admin', 'pw_file': os.path.join(HOME, 'nvr', '.pw'),
    'api_url': 'https://n8n-new-project-gwf2.onrender.com/webhook/service-queue-api',
    'interval_sec': 3,
    'zones': [
        # roi = [x1,y1,x2,y2] พิกัดภาพเต็ม 2560x1440; motion_thr/change_thr = ค่าเฉลี่ยผลต่างสีเทา (0-255) ในโซน
        {'channel': 6, 'source': 'nvr-ch6', 'name': 'ลิฟต์ซ่อม', 'roi': [560, 460, 1520, 1360], 'motion_thr': 6, 'change_thr': 14, 'stable_sec': 15, 'pad': 0.15, 'max_side': 2000},
        {'channel': 6, 'source': 'nvr-ch6', 'name': 'ช่องซ่อมขวา', 'roi': [1360, 340, 2200, 1040], 'motion_thr': 6, 'change_thr': 22, 'stable_sec': 30, 'pad': 0.15, 'max_side': 2000},   # ช่างยืนทำงาน เปลี่ยนท่า ~15 → ตั้งสูงกว่า
    ],
    'send_on_start': False,   # true = รายงานสภาพปัจจุบันของทุกโซนทันทีตอนเริ่ม (ไว้ทดสอบ)
    'save_last': True,
}

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', stream=sys.stdout)
log = logging.getLogger('platewatch')


def load_cfg():
    cfg = dict(DEFAULT)
    if os.path.exists(CFG_PATH):
        try:
            cfg.update(json.load(open(CFG_PATH, encoding='utf-8')))
        except Exception as e:
            log.error('config load failed: %s', e)
    return cfg


def snapshot(cfg, auth, channel):
    r = requests.get(f"http://{cfg['nvr_host']}/cgi-bin/snapshot.cgi?channel={channel}", auth=auth, timeout=10)
    r.raise_for_status()
    img = cv2.imdecode(np.frombuffer(r.content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError('decode failed')
    return img


def zone_gray(img, roi):
    x1, y1, x2, y2 = roi
    g = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, (320, int(320 * (y2 - y1) / max(1, x2 - x1))))
    return cv2.GaussianBlur(g, (7, 7), 0).astype(np.int16)


def mean_diff(a, b):
    return float(np.mean(np.abs(a - b))) if a is not None and b is not None and a.shape == b.shape else 999.0


def crop_jpeg(img, roi, pad, max_side):
    H, W = img.shape[:2]
    x1, y1, x2, y2 = roi
    pw, ph = (x2 - x1) * pad, (y2 - y1) * pad
    x1, y1 = max(0, int(x1 - pw)), max(0, int(y1 - ph))
    x2, y2 = min(W, int(x2 + pw)), min(H, int(y2 + ph))
    crop = img[y1:y2, x1:x2]
    s = max(crop.shape[:2])
    f = 1.0
    if s > max_side:
        f = max_side / s
        crop = cv2.resize(crop, (int(crop.shape[1] * f), int(crop.shape[0] * f)))
    elif s < UPSCALE_MIN:   # โซนเล็ก (ป้ายไกลกล้อง ~70px) ขยายก่อนส่งให้ GPT อ่านง่ายขึ้น
        f = UPSCALE_MIN / s
        crop = cv2.resize(crop, (int(crop.shape[1] * f), int(crop.shape[0] * f)), interpolation=cv2.INTER_CUBIC)
    # วาดกรอบสีเหลือง = ขอบเขตโซนจริง (ส่วนที่เกินคือ pad) ให้ GPT อ่านเฉพาะรถในกรอบ — กันอ่านป้ายรถช่องข้าง ๆ ที่โผล่เข้ามาในขอบ (2026-10-27 เคส 2กข 909)
    rx1, ry1, rx2, ry2 = roi
    crop = np.ascontiguousarray(crop)
    cv2.rectangle(crop, (int((rx1 - x1) * f), int((ry1 - y1) * f)), (int((rx2 - x1) * f) - 1, int((ry2 - y1) * f) - 1), (0, 220, 255), 4)
    draw_grid(crop)
    ok, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return base64.b64encode(buf.tobytes()).decode('ascii'), [x1, y1, x2 - x1, y2 - y1]


GRID_ROWS = 8          # ตารางบนภาพโซนให้ GPT ชี้ช่องที่มีป้าย (plate_cell) — แม่นกว่าให้ประมาณพิกัด; คอลัมน์ปรับตามสัดส่วนภาพให้ช่องใกล้จัตุรัส (โซนแคบ-สูง ch10 เคยได้ช่องกว้าง 65px)
GRID_COLS = 'ABCDEFGH'
PLATE_MIN_HALF = 200   # ครึ่งความกว้าง/สูงขั้นต่ำ (px ภาพต้นฉบับ) ของภาพซูมป้าย — เผื่อ GPT ชี้ช่องเพี้ยน 1-2 ช่อง


def grid_dims(w, h):
    cols = max(3, min(len(GRID_COLS), int(round(GRID_ROWS * w / float(h)))))
    return cols, GRID_ROWS


def draw_grid(crop, cols=None, rows=None):
    # เส้นตารางสีม่วง + ป้ายกำกับคอลัมน์ (ขอบบน/ล่าง) และแถว (ขอบซ้าย/ขวา) — ป้ายอยู่ในแถบขอบซึ่งเป็น pad นอกโซนอยู่แล้ว
    h, w = crop.shape[:2]
    if not cols:
        cols, rows = grid_dims(w, h)
    for i in range(1, cols):
        x = int(w * i / cols); cv2.line(crop, (x, 0), (x, h - 1), (255, 0, 255), 2)
    for i in range(1, rows):
        y = int(h * i / rows); cv2.line(crop, (0, y), (w - 1, y), (255, 0, 255), 2)
    fs = max(0.9, w / 1400.0); th = 2
    for i in range(cols):
        lab = GRID_COLS[i]; (tw, tht), _ = cv2.getTextSize(lab, cv2.FONT_HERSHEY_SIMPLEX, fs, th)
        cx = int(w * (i + 0.5) / cols)
        for y in (tht + 8, h - 8):
            cv2.rectangle(crop, (cx - tw // 2 - 4, y - tht - 4), (cx + tw // 2 + 4, y + 4), (255, 0, 255), -1)
            cv2.putText(crop, lab, (cx - tw // 2, y), cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 255, 255), th, cv2.LINE_AA)
    for i in range(rows):
        lab = str(i + 1); (tw, tht), _ = cv2.getTextSize(lab, cv2.FONT_HERSHEY_SIMPLEX, fs, th)
        cy = int(h * (i + 0.5) / rows)
        for x in (8, w - tw - 8):
            cv2.rectangle(crop, (x - 4, cy - tht // 2 - 4), (x + tw + 4, cy + tht // 2 + 4), (255, 0, 255), -1)
            cv2.putText(crop, lab, (x, cy + tht // 2), cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 255, 255), th, cv2.LINE_AA)
    return cols, rows


TILE_TARGET = 600      # ขนาดเป้าหมายต่อแผ่น (px ต้นฉบับ) → โซน 1248x1115 = 2x2 แผ่น, โซนแคบ 719x1351 = 1x2
TILE_OVERLAP = 0.15
TILE_SHORT = 768       # ส่งแผ่นให้ด้านสั้น = 768px (ขนาดที่ GPT ใช้จริง) → ป้ายใหญ่ขึ้น ~2.5 เท่าเทียบส่งทั้งโซน
TILE_GRID = 4


def make_tiles(img, roi, box):
    # แบ่งบริเวณ box (พิกัดภาพเต็ม) เป็นแผ่นซ้อนกัน 15% วาดกรอบเหลือง roi + ตาราง 4x4 + ป้าย T<n> มุมซ้ายบน → [{'b64','x1','y1','w','h'}]
    bx, by, bw, bh = box
    nx = max(1, min(3, int(round(bw / float(TILE_TARGET))))); ny = max(1, min(3, int(round(bh / float(TILE_TARGET)))))
    tw, th = bw / float(nx), bh / float(ny)
    ox, oy = tw * TILE_OVERLAP, th * TILE_OVERLAP
    full = img.copy()
    rx1, ry1, rx2, ry2 = roi
    cv2.rectangle(full, (rx1, ry1), (rx2 - 1, ry2 - 1), (0, 220, 255), 3)
    tiles = []
    for j in range(ny):
        for i in range(nx):
            x1 = int(max(bx, bx + i * tw - ox)); y1 = int(max(by, by + j * th - oy))
            x2 = int(min(bx + bw, bx + (i + 1) * tw + ox)); y2 = int(min(by + bh, by + (j + 1) * th + oy))
            t = full[y1:y2, x1:x2]
            f = TILE_SHORT / float(min(t.shape[:2]))
            if f > 1:
                t = cv2.resize(t, (int(t.shape[1] * f), int(t.shape[0] * f)), interpolation=cv2.INTER_CUBIC)
            t = np.ascontiguousarray(t)
            draw_grid(t, TILE_GRID, TILE_GRID)
            lab = 'T%d' % (len(tiles) + 1)
            cv2.rectangle(t, (0, 0), (120, 64), (0, 0, 0), -1)
            cv2.putText(t, lab, (8, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 255, 255), 3, cv2.LINE_AA)
            ok, buf = cv2.imencode('.jpg', t, [cv2.IMWRITE_JPEG_QUALITY, 85])
            tiles.append({'b64': base64.b64encode(buf.tobytes()).decode('ascii'), 'x1': x1, 'y1': y1, 'w': x2 - x1, 'h': y2 - y1})
    return tiles


def cell_region(img, region, cols, rows, cell, grow=None):
    # ช่องตาราง cell บน region (x1,y1,w,h พิกัดภาพเต็ม) ที่แบ่ง cols x rows → กรอบ ±max(1.5 ช่อง, PLATE_MIN_HALF); grow ขยายด้านที่ป้ายโดนตัด
    H, W = img.shape[:2]
    bx, by, bw, bh = region
    c = GRID_COLS.index(cell[0]); r = int(cell[1:]) - 1
    cw, ch = bw / float(cols), bh / float(rows)
    cx, cy = bx + (c + 0.5) * cw, by + (r + 0.5) * ch
    hx, hy = max(1.5 * cw, PLATE_MIN_HALF), max(1.5 * ch, PLATE_MIN_HALF)
    g = grow or {}
    x1, y1 = max(0, int(cx - hx - g.get('left', 0))), max(0, int(cy - hy - g.get('top', 0)))
    x2, y2 = min(W, int(cx + hx + g.get('right', 0))), min(H, int(cy + hy + g.get('bottom', 0)))
    return x1, y1, x2, y2


def plate_cell_region(img, box, cell, grow=None):
    # cell เช่น "G6" บนตาราง (cols,rows) ของภาพที่ส่ง (= box ในพิกัดภาพเต็ม) → กรอบรอบช่องนั้น ±max(1.5 ช่อง, PLATE_MIN_HALF) จากภาพต้นฉบับ
    # grow = {'top'|'bottom'|'left'|'right': px} ขยายด้านที่ GPT บอกว่าป้ายโดนตัด (รอบซ้ำ)
    H, W = img.shape[:2]
    bx, by, bw, bh = box
    cols, rows = grid_dims(bw, bh)
    c = GRID_COLS.index(cell[0]); r = int(cell[1:]) - 1
    cw, ch = bw / float(cols), bh / float(rows)
    cx, cy = bx + (c + 0.5) * cw, by + (r + 0.5) * ch
    hx, hy = max(1.5 * cw, PLATE_MIN_HALF), max(1.5 * ch, PLATE_MIN_HALF)
    g = grow or {}
    x1, y1 = max(0, int(cx - hx - g.get('left', 0))), max(0, int(cy - hy - g.get('top', 0)))
    x2, y2 = min(W, int(cx + hx + g.get('right', 0))), min(H, int(cy + hy + g.get('bottom', 0)))
    return x1, y1, x2, y2


def region_jpeg(img, reg):
    x1, y1, x2, y2 = reg
    if x2 - x1 < 20 or y2 - y1 < 20:
        return None
    crop = img[y1:y2, x1:x2]
    f = min(PLATE_OUT_W / crop.shape[1], 6.0)
    crop = cv2.resize(crop, (int(crop.shape[1] * f), int(crop.shape[0] * f)), interpolation=cv2.INTER_CUBIC)
    ok, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(buf.tobytes()).decode('ascii')


def plate_cell_crop_jpeg(img, box, cell, grow=None):
    return region_jpeg(img, plate_cell_region(img, box, cell, grow))


PLATE_EXPAND = 2.6     # ขยายกรอบป้ายที่ GPT บอก (กรอบ GPT คลาดเคลื่อนได้) ก่อนตัด
PLATE_OUT_W = 900      # ความกว้างภาพซูมป้ายที่ส่ง (ขยาย cubic จากภาพต้นฉบับ)


def plate_crop_jpeg(img, box, pb):
    # box = [x1,y1,w,h] ของภาพที่ส่งรอบ 1 (พิกัดภาพเต็ม) · pb = plate_box จาก GPT เป็นสัดส่วน 0-1 ของภาพที่ส่ง (ถ้าเกิน 1.5 ถือว่าเป็นพิกเซลของภาพที่ส่ง)
    H, W = img.shape[:2]
    bx, by, bw, bh = box
    px, py, pw_, ph_ = [float(v) for v in pb]
    if max(px, py, pw_, ph_) > 1.5:   # GPT ตอบเป็นพิกเซล → แปลงเป็นสัดส่วนด้วยขนาดภาพที่ส่ง (ด้านยาว = UPSCALE_MIN หรือ max_side)
        s = max(bw, bh); f = (UPSCALE_MIN / s) if s < UPSCALE_MIN else 1.0
        px, py, pw_, ph_ = px / (bw * f), py / (bh * f), pw_ / (bw * f), ph_ / (bh * f)
    cx, cy = bx + (px + pw_ / 2) * bw, by + (py + ph_ / 2) * bh
    w = max(pw_ * bw * PLATE_EXPAND, 180)
    h = max(ph_ * bh * PLATE_EXPAND, 150)
    x1, y1 = max(0, int(cx - w / 2)), max(0, int(cy - h / 2))
    x2, y2 = min(W, int(cx + w / 2)), min(H, int(cy + h / 2))
    if x2 - x1 < 20 or y2 - y1 < 20:
        return None
    crop = img[y1:y2, x1:x2]
    f = min(PLATE_OUT_W / crop.shape[1], 6.0)
    crop = cv2.resize(crop, (int(crop.shape[1] * f), int(crop.shape[0] * f)), interpolation=cv2.INTER_CUBIC)
    ok, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(buf.tobytes()).decode('ascii')


def post_event(cfg, z, img):
    b64, box = crop_jpeg(img, z['roi'], z['pad'], z['max_side'])
    tiles = make_tiles(img, z['roi'], box)
    payload = {'action': 'vehicle_arrived', 'source': z['source'], 'zone': z['name'], 'vehicle_count': 1,
               'image_base64': b64, 'vehicle_boxes': [box], 'tiles': [t['b64'] for t in tiles]}
    r = requests.post(cfg['api_url'], json=payload, timeout=90)
    log.info('[%s/%s] vehicle_arrived sent: http %s %s', z['source'], z['name'], r.status_code, r.text[:200].replace('\n', ' '))
    # รอบ 2 (2026-10-27): n8n ตอบ plate_box (ตำแหน่งป้ายที่ GPT เห็นในภาพโซน) → ตัดป้ายจากภาพต้นฉบับ ขยาย ส่ง read_plate ให้อ่านซ้ำจากภาพซูม (LINE แจ้งรอบนี้)
    try:
        j = r.json()
    except Exception:
        return
    pb, cell, tile, eid = j.get('plate_box'), j.get('plate_cell'), j.get('plate_tile'), j.get('event_id')
    if not eid:
        return
    cell = str(cell).strip().upper() if cell else None
    if cell and not (len(cell) in (2, 3) and cell[0] in GRID_COLS and cell[1:].isdigit() and 1 <= int(cell[1:]) <= GRID_ROWS):
        cell = None
    tile = int(tile) if isinstance(tile, int) and 1 <= tile <= len(tiles) and cell and cell[0] in GRID_COLS[:TILE_GRID] and int(cell[1:]) <= TILE_GRID else None
    if tile:   # ชี้จากแผ่นขยาย (แม่นสุด) → ช่องตารางบนแผ่นนั้น
        tr = tiles[tile - 1]; region = (tr['x1'], tr['y1'], tr['w'], tr['h']); gcols = grows = TILE_GRID
    else:
        region = tuple(box); gcols, grows = grid_dims(box[2], box[3])
    if not cell and not (isinstance(pb, list) and len(pb) == 4):
        return
    if not cell and max(float(pb[2]), float(pb[3])) > 0.35 and max(float(v) for v in pb) <= 1.5:   # กรอบใหญ่เกินจะเป็นป้าย (เช่น ตัวรถ/แผ่นดำบนลิฟต์) ไม่ซูม
        log.info('[%s/%s] plate_box too large, skip pass 2: %s', z['source'], z['name'], pb); return
    try:
        zb64 = region_jpeg(img, cell_region(img, region, gcols, grows, cell)) if cell else plate_crop_jpeg(img, box, pb)   # ช่องตาราง (แผ่นขยาย/ภาพโซน) ก่อน, plate_box สำรอง
    except Exception as e:
        log.error('[%s/%s] plate crop failed: %s (cell=%s box=%s)', z['source'], z['name'], e, cell, pb); return
    if not zb64:
        log.info('[%s/%s] plate region too small, skip pass 2: %s', z['source'], z['name'], cell or pb); return
    grow = {}
    for attempt in range(3):   # รอบ 2 + ส่งซ้ำได้อีก 2 ครั้งเมื่อ GPT บอกว่าป้ายโดนขอบภาพตัด (cut_edge) → ขยายด้านนั้น
        final = attempt == 2 or not cell
        try:
            open(os.path.expanduser('~/nvr/last_plate_%s.jpg' % z['source']), 'wb').write(base64.b64decode(zb64))
        except Exception:
            pass
        p2 = {'action': 'read_plate', 'event_id': int(eid), 'source': z['source'], 'zone': z['name'], 'image_base64': zb64, 'final': final}
        try:
            r2 = requests.post(cfg['api_url'], json=p2, timeout=90)
            log.info('[%s/%s] read_plate (pass 2.%d, at=%s%s grow=%s) sent: http %s %s', z['source'], z['name'], attempt + 1, ('T%d/' % tile) if tile else '', cell or pb, grow, r2.status_code, r2.text[:200].replace('\n', ' '))
            j2 = r2.json()
        except Exception as e:
            log.error('[%s/%s] read_plate failed: %s', z['source'], z['name'], e); return
        edge = j2.get('cut_edge') if isinstance(j2, dict) else None
        if final or edge not in ('top', 'bottom', 'left', 'right'):
            return
        grow[edge] = grow.get(edge, 0) + PLATE_MIN_HALF * 1.5
        zb64 = region_jpeg(img, cell_region(img, region, gcols, grows, cell, grow))
        if not zb64:
            return


def main():
    cfg = load_cfg()
    auth = HTTPDigestAuth(cfg['nvr_user'], open(cfg['pw_file']).read().strip())
    zones = cfg['zones']
    st = [{'prev': None, 'ref': None, 'last_motion': time.time(), 'pending': False} for _ in zones]
    channels = sorted(set(z['channel'] for z in zones))
    log.info('platewatch started: %d zone(s) on channel(s) %s, interval %ss', len(zones), channels, cfg['interval_sec'])
    last_status = 0
    while True:
        t0 = time.time()
        frames = {}
        for ch in channels:
            try:
                frames[ch] = snapshot(cfg, auth, ch)
            except Exception as e:
                log.error('[ch%s] snapshot failed: %s', ch, e)
        for i, z in enumerate(zones):
            img = frames.get(z['channel'])
            if img is None:
                continue
            s = st[i]
            try:
                g = zone_gray(img, z['roi'])
                dm = mean_diff(g, s['prev']) if s['prev'] is not None else 0.0
                s['prev'] = g
                now = time.time()
                if dm > z['motion_thr']:
                    s['last_motion'] = now
                if s['ref'] is None:                       # เฟรมแรก = สภาพตั้งต้น
                    s['ref'] = g
                    if cfg.get('send_on_start'):
                        log.info('[%s/%s] send_on_start', z['source'], z['name'])
                        post_event(cfg, z, img)
                    continue
                dc = mean_diff(g, s['ref'])
                stable = (now - s['last_motion']) >= z['stable_sec']
                if dc > z['change_thr'] and not stable:
                    s['pending'] = True                    # มีการเปลี่ยนแปลง รอให้นิ่ง
                if stable and dc > z['change_thr']:
                    log.info('[%s/%s] new state (change %.1f, motion %.1f) -> report', z['source'], z['name'], dc, dm)
                    s['ref'] = g; s['pending'] = False
                    post_event(cfg, z, img)
                elif stable and s['pending']:
                    s['pending'] = False                   # เปลี่ยนแล้วกลับมาเหมือนเดิม (คนเดินผ่าน)
                s['dc'], s['dm'] = dc, dm
            except Exception as e:
                log.error('[%s/%s] %s', z['source'], z['name'], e)
                log.debug(traceback.format_exc())
        if cfg.get('save_last'):
            for ch, img in frames.items():
                dbg = img.copy()
                for i, z in enumerate(zones):
                    if z['channel'] != ch:
                        continue
                    x1, y1, x2, y2 = z['roi']
                    cv2.rectangle(dbg, (x1, y1), (x2, y2), (255, 0, 0), 3)
                    cv2.putText(dbg, f"zone{i + 1} chg={st[i].get('dc', 0):.1f} mot={st[i].get('dm', 0):.1f}", (x1 + 10, y1 + 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2)   # ฟอนต์ cv2 ไม่มีไทย
                cv2.imwrite(os.path.join(HOME, 'nvr', f'last_ch{ch}.jpg'), cv2.resize(dbg, (1280, 720)))
        if time.time() - last_status > 60:
            last_status = time.time()
            log.info('status: ' + ' | '.join(f"{z['name']} chg={st[i].get('dc', 0):.1f} mot={st[i].get('dm', 0):.1f}" for i, z in enumerate(zones)))
        time.sleep(max(0.5, cfg['interval_sec'] - (time.time() - t0)))


if __name__ == '__main__':
    main()
