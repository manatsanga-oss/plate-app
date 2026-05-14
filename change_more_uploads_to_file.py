"""
เปลี่ยน 4 actions เพิ่มเติมจาก OneDrive download → รับไฟล์ผ่าน upload:
  1. upload-dcs-backorders     (Upload_Data.json)
  2. upload-pending-job        (Upload_Data.json)
  3. upload-yamaha-b2b-orders  (Yamaha B2B Upload (1).json)
  4. upload-yamaha-b2b-backorders (Yamaha B2B Upload (1).json)

ทุก target ทำ 3 อย่างเหมือนกัน:
  - Webhook httpMethod = POST
  - Extract from File binaryPropertyName = "file"
  - ลบ OneDrive nodes ระหว่าง Webhook → Extract แล้วเชื่อม Webhook → Extract ตรงๆ
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

ONEDRIVE = Path(r"C:/Users/manat/OneDrive/New folder")

TARGETS = [
    {
        "file": ONEDRIVE / "Upload_Data.json",
        "webhook": "Webhook Upload DCS Backorders",
        "extract": "Extract DCS Backorders",
        "remove": ["Download DCS Backorders"],
    },
    {
        "file": ONEDRIVE / "Upload_Data.json",
        "webhook": "Webhook Upload ค้างปิด JOB",
        "extract": "Extract ค้างปิด JOB",
        "remove": ["Get items ค้างปิด JOB", "Download ค้างปิด JOB"],
    },
    {
        "file": ONEDRIVE / "Yamaha B2B Upload (1).json",
        "webhook": "Webhook Yamaha B2B Orders",
        "extract": "Extract Yamaha B2B Orders",
        "remove": ["Get items in a folder", "Download Yamaha B2B Orders"],
    },
    {
        "file": ONEDRIVE / "Yamaha B2B Upload (1).json",
        "webhook": "Webhook Yamaha B2B Backorders",
        "extract": "Extract Yamaha B2B Backorders",
        "remove": ["Download Yamaha B2B Backorders"],
    },
]

# group targets ตามไฟล์เพื่อ load/save ครั้งเดียวต่อไฟล์
by_file = {}
for t in TARGETS:
    by_file.setdefault(str(t["file"]), []).append(t)

for fpath, targets in by_file.items():
    p = Path(fpath)
    if not p.exists():
        print(f"SKIP: ไม่พบไฟล์ {p.name}")
        continue
    wf = json.loads(p.read_text(encoding='utf-8'))

    for t in targets:
        webhook_node = next((n for n in wf['nodes'] if n['name'] == t['webhook']), None)
        extract_node = next((n for n in wf['nodes'] if n['name'] == t['extract']), None)
        if not webhook_node or not extract_node:
            print(f"  SKIP {t['webhook']}: ไม่พบ node (webhook={bool(webhook_node)}, extract={bool(extract_node)})")
            continue

        # 1) Webhook → POST
        webhook_node['parameters']['httpMethod'] = 'POST'

        # 2) Extract → รับ binary 'file'
        extract_node['parameters']['binaryPropertyName'] = 'file'

        # 3) ลบ nodes OneDrive
        remove_set = set(t['remove'])
        wf['nodes'] = [n for n in wf['nodes'] if n['name'] not in remove_set]

        # 4) แก้ connections — ลบ connection ของ remove nodes + เชื่อม Webhook → Extract
        conns = wf.setdefault('connections', {})
        for name in list(conns.keys()):
            if name in remove_set:
                del conns[name]
        conns[t['webhook']] = {
            "main": [[
                {"node": t['extract'], "type": "main", "index": 0}
            ]]
        }
        print(f"  OK {t['webhook']} → {t['extract']} (removed: {', '.join(t['remove'])})")

    p.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"saved: {p.name}")

print()
print("ต่อไป:")
print("  1. Import workflow ทั้ง 2 ไฟล์เข้า n8n (replace ตัวเดิม)")
print("  2. แก้ UploadPage.jsx เพิ่ม dcs-backorders, pending-job, yamaha-b2b-orders, yamaha-b2b-backorders ใน FILE_UPLOAD_KEYS")
