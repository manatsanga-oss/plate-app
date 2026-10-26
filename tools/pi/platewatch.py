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
    if s > max_side:
        f = max_side / s
        crop = cv2.resize(crop, (int(crop.shape[1] * f), int(crop.shape[0] * f)))
    elif s < UPSCALE_MIN:   # โซนเล็ก (ป้ายไกลกล้อง ~70px) ขยายก่อนส่งให้ GPT อ่านง่ายขึ้น
        f = UPSCALE_MIN / s
        crop = cv2.resize(crop, (int(crop.shape[1] * f), int(crop.shape[0] * f)), interpolation=cv2.INTER_CUBIC)
    ok, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return base64.b64encode(buf.tobytes()).decode('ascii'), [x1, y1, x2 - x1, y2 - y1]


def post_event(cfg, z, img):
    b64, box = crop_jpeg(img, z['roi'], z['pad'], z['max_side'])
    payload = {'action': 'vehicle_arrived', 'source': z['source'], 'zone': z['name'], 'vehicle_count': 1,
               'image_base64': b64, 'vehicle_boxes': [box]}
    r = requests.post(cfg['api_url'], json=payload, timeout=90)
    log.info('[%s/%s] vehicle_arrived sent: http %s %s', z['source'], z['name'], r.status_code, r.text[:200].replace('\n', ' '))


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
