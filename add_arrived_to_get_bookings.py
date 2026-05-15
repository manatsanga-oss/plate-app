"""
แก้ Code Build Get Bookings SQL ให้ SELECT arrived_at + arrived_within_range
เพื่อให้ BookingPage แสดงสถานะ "จัดส่งสำเร็จ" ได้
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบจองคนขับรถ (PostgreSQL) (6).json")
wf = json.loads(dst.read_text(encoding='utf-8'))

NEW_JS = (
    "const query = `SELECT booking_id, booker_name, branch, booking_date,\n"
    "    booking_time, delivery_type, car_model,\n"
    "    finance_company, driver_id, destination,\n"
    "    destination_formatted, distance_text, distance_meters,\n"
    "    duration_text, purpose, status, cancel_reason,\n"
    "    arrived_at, arrived_within_range,\n"
    "    created_at FROM bookings\n"
    "    ORDER BY created_at DESC LIMIT 200`;\n"
    "return [{ json: { query } }];\n"
)

node = next((n for n in wf['nodes'] if n.get('name') == 'Code Build Get Bookings SQL'), None)
if not node:
    print('ERROR: Code Build Get Bookings SQL ไม่พบ')
    sys.exit(1)

node['parameters']['jsCode'] = NEW_JS
dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')

print('OK: Code Build Get Bookings SQL อัปเดต')
print('  - SELECT เพิ่ม: arrived_at, arrived_within_range')
