"""
ย้าย flow Yamaha B2B (Orders + Backorders) จาก workflow แยก
เข้ามาอยู่ใน Upload_Data workflow รวมกัน

source: Yamaha B2B Upload (2).json (workflow แยก ใช้ OneDrive)
target: Upload_Data.json (รวมทุก upload)

ทำ:
- Copy nodes ที่จำเป็น (Webhook, Extract, Map, Reload, Respond) ไม่เอา OneDrive
- ตั้ง Webhook httpMethod = POST
- ตั้ง Extract binaryPropertyName = "file"
- เพิ่ม connections ใหม่: Webhook → Extract → Map → Reload → Respond
- ใส่ตำแหน่ง position ใหม่ใน canvas (ใต้ flow อื่นๆ)

หลังรัน script:
- delete workflow "Yamaha B2B Upload" ใน n8n
- import Upload_Data.json ใหม่
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

ONEDRIVE = Path(r"C:/Users/manat/OneDrive/New folder")
SOURCE = ONEDRIVE / "Yamaha B2B Upload (2).json"
TARGET = ONEDRIVE / "Upload_Data.json"

source = json.loads(SOURCE.read_text(encoding='utf-8'))
target = json.loads(TARGET.read_text(encoding='utf-8'))

# nodes ที่จะ copy (ตามชื่อ)
COPY_NODES = [
    "Webhook Yamaha B2B Orders",
    "Extract Yamaha B2B Orders",
    "Map Yamaha B2B Orders",
    "Reload Yamaha B2B Orders",
    "Respond Yamaha B2B Orders",
    "Webhook Yamaha B2B Backorders",
    "Extract Yamaha B2B Backorders",
    "Map Yamaha B2B Backorders",
    "Reload Yamaha B2B Backorders",
    "Respond Yamaha B2B Backorders",
]

# ตำแหน่ง canvas — วางไว้ใต้ flow อื่นๆ (y ~ 40000)
POSITIONS = {
    "Webhook Yamaha B2B Orders":      [58576, 40000],
    "Extract Yamaha B2B Orders":      [58832, 40000],
    "Map Yamaha B2B Orders":          [59072, 40000],
    "Reload Yamaha B2B Orders":       [59312, 40000],
    "Respond Yamaha B2B Orders":      [59552, 40000],
    "Webhook Yamaha B2B Backorders":  [58576, 40240],
    "Extract Yamaha B2B Backorders":  [58832, 40240],
    "Map Yamaha B2B Backorders":      [59072, 40240],
    "Reload Yamaha B2B Backorders":   [59312, 40240],
    "Respond Yamaha B2B Backorders":  [59552, 40240],
}

# connections ใหม่ (ทดแทน chain ตรงของแต่ละ flow)
NEW_CONNS = {
    "Webhook Yamaha B2B Orders":     "Extract Yamaha B2B Orders",
    "Extract Yamaha B2B Orders":     "Map Yamaha B2B Orders",
    "Map Yamaha B2B Orders":         "Reload Yamaha B2B Orders",
    "Reload Yamaha B2B Orders":      "Respond Yamaha B2B Orders",
    "Webhook Yamaha B2B Backorders": "Extract Yamaha B2B Backorders",
    "Extract Yamaha B2B Backorders": "Map Yamaha B2B Backorders",
    "Map Yamaha B2B Backorders":     "Reload Yamaha B2B Backorders",
    "Reload Yamaha B2B Backorders":  "Respond Yamaha B2B Backorders",
}

existing_names = {n['name'] for n in target['nodes']}
src_by_name = {n['name']: n for n in source['nodes']}

added = 0
for name in COPY_NODES:
    if name in existing_names:
        print(f"  SKIP {name}: มีอยู่แล้วใน target")
        continue
    src = src_by_name.get(name)
    if not src:
        print(f"  ERROR {name}: ไม่พบใน source")
        continue
    node = json.loads(json.dumps(src))  # deep copy
    node['position'] = POSITIONS[name]
    if name.startswith("Webhook "):
        node['parameters']['httpMethod'] = 'POST'
    elif name.startswith("Extract "):
        node['parameters']['binaryPropertyName'] = 'file'
    target['nodes'].append(node)
    added += 1
    print(f"  ADD {name}")

# ใส่ connections
conns = target.setdefault('connections', {})
for src_name, dst_name in NEW_CONNS.items():
    conns[src_name] = {
        "main": [[{"node": dst_name, "type": "main", "index": 0}]]
    }

TARGET.write_text(json.dumps(target, ensure_ascii=False, indent=2), encoding='utf-8')

print()
print(f"OK: เพิ่ม {added} nodes + connections เข้า Upload_Data.json")
print()
print("ต่อไป:")
print("  1. ใน n8n UI: ลบ workflow 'Yamaha B2B Upload' ทิ้ง (กันชน webhook path)")
print("  2. ลบ workflow 'Upload_Data' เก่าทิ้ง")
print("  3. Import Upload_Data.json ใหม่ → Activate")
