"""
แก้ get_distance code node ให้เรียก Google Geocoding API
เพื่อ return พิกัด dest_lat / dest_lng เพิ่ม จากเดิมที่คืนแค่ distance_text/duration_text/destination_name

หลังแก้นี้:
- save_booking + send_booking_flex จะมี dest_lat/dest_lng ส่งเข้า LIFF URL
- confirm_arrival คำนวณ Haversine ได้ → ห่างจุดหมายมีค่าจริง (ไม่ใช่ -)
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบจองคนขับรถ (PostgreSQL) (6).json")
wf = json.loads(dst.read_text(encoding='utf-8'))

# หา Google API key จาก HTTP Request1 (Distance Matrix node)
api_key = None
for n in wf['nodes']:
    if n.get('name') == 'HTTP Request1' and n.get('type') == 'n8n-nodes-base.httpRequest':
        for p in n['parameters'].get('queryParameters', {}).get('parameters', []):
            if p.get('name') == 'key':
                api_key = p['value']
                break
if not api_key:
    print('ERROR: ไม่พบ Google API key ใน HTTP Request1')
    sys.exit(1)

# JS ใหม่ — เพิ่มการเรียก Geocoding API
NEW_JS = r"""
const r = $input.first().json;
const row = r?.rows?.[0]?.elements?.[0];
const destName = r?.destination_addresses?.[0] || '';

// Geocode → lat/lng
let dest_lat = null, dest_lng = null;
try {
  const destText = $('Webhook').first().json.body.destination || destName;
  if (destText) {
    const geo = await this.helpers.httpRequest({
      url: 'https://maps.googleapis.com/maps/api/geocode/json',
      qs: { address: destText, language: 'th', key: '__API_KEY__' },
      json: true,
    });
    const loc = geo && geo.results && geo.results[0] && geo.results[0].geometry && geo.results[0].geometry.location;
    if (loc) {
      dest_lat = loc.lat;
      dest_lng = loc.lng;
    }
  }
} catch (e) {
  console.log('geocode failed:', e.message);
}

return [{ json: {
  distance_text: row?.distance?.text || '-',
  duration_text: row?.duration?.text || '-',
  destination_name: destName,
  dest_lat,
  dest_lng,
}}];
""".replace('__API_KEY__', api_key)

node = next((n for n in wf['nodes'] if n.get('name') == 'get_distance'), None)
if not node:
    print('ERROR: get_distance code node ไม่พบ')
    sys.exit(1)

node['parameters']['jsCode'] = NEW_JS
dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')

print('OK: get_distance node updated')
print('  - คืนค่าเพิ่ม: dest_lat, dest_lng (จาก Google Geocoding API)')
print('  - reuse Google API key เดียวกับ Distance Matrix')
print()
print('ต่อไป:')
print('  1. Import workflow JSON ใหม่เข้า n8n (replace ตัวเดิม)')
print('  2. แก้ BookingPage.jsx ให้ส่ง dest_lat/dest_lng ใน save_booking + send_booking_flex')
