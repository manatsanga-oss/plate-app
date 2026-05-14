"""
เปลี่ยน DCS Orders ใน Upload_Data workflow จาก OneDrive download → รับไฟล์ผ่าน upload

ก่อน:
  Webhook Upload DCS Orders → Get items DCS Orders1 → Download DCS Orders → Extract → Map → Insert → Respond

หลัง:
  Webhook Upload DCS Orders → Extract DCS Orders (binaryPropertyName=file) → Map → Insert → Respond

ฝั่ง Frontend: เพิ่ม "dcs-orders" ใน FILE_UPLOAD_KEYS ที่ UploadPage.jsx
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/Upload_Data.json")
wf = json.loads(dst.read_text(encoding='utf-8'))

REMOVE_NODES = {'Get items DCS Orders1', 'Download DCS Orders'}

# 1) เอา node OneDrive ออก
before = len(wf['nodes'])
wf['nodes'] = [n for n in wf['nodes'] if n['name'] not in REMOVE_NODES]
removed = before - len(wf['nodes'])

# 2) แก้ Webhook ให้รับ POST (default คือ GET)
webhook = next((n for n in wf['nodes'] if n['name'] == 'Webhook Upload DCS Orders'), None)
if not webhook:
    print('ERROR: Webhook Upload DCS Orders ไม่พบ')
    sys.exit(1)
webhook['parameters']['httpMethod'] = 'POST'

# 3) แก้ Extract DCS Orders ให้รับ binary จาก field 'file' (FormData key จาก frontend)
extract = next((n for n in wf['nodes'] if n['name'] == 'Extract DCS Orders'), None)
if not extract:
    print('ERROR: Extract DCS Orders ไม่พบ')
    sys.exit(1)
extract['parameters']['binaryPropertyName'] = 'file'

# 3) ลบ connections ของ node ที่ลบ
conns = wf['connections']
for name in list(conns.keys()):
    if name in REMOVE_NODES:
        del conns[name]

# 4) แก้ connection ของ Webhook ให้ชี้ตรงไปที่ Extract DCS Orders
conns['Webhook Upload DCS Orders'] = {
    "main": [[
        {"node": "Extract DCS Orders", "type": "main", "index": 0}
    ]]
}

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')

print(f'OK: DCS Orders เปลี่ยนเป็น file upload เรียบร้อย')
print(f'  - ลบ nodes: {", ".join(REMOVE_NODES)} ({removed} nodes)')
print(f'  - Extract DCS Orders ใช้ binaryPropertyName = "file"')
print(f'  - Webhook Upload DCS Orders → Extract DCS Orders (direct)')
print()
print('ขั้นถัดไป:')
print('  1. Import Upload_Data.json ใหม่เข้า n8n (เพื่อให้ workflow อัปเดต)')
print('  2. แก้ UploadPage.jsx เพิ่ม "dcs-orders" ใน FILE_UPLOAD_KEYS')
