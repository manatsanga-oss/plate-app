"""
ย้าย LINE channel access token จาก hardcoded → env var
ค้นหาทุก HTTP node ที่ส่งไป api.line.me แล้วเปลี่ยน Authorization header
เป็น expression อ้าง $env.LINE_ACCESS_TOKEN

ต้องตั้ง env var ใน n8n ก่อน:
  - docker: -e LINE_ACCESS_TOKEN=<token> หรือใส่ใน .env
  - n8n cloud: Settings → Variables (ถ้ามี enterprise) หรือ ENV ใน host
  - self-host npm: export LINE_ACCESS_TOKEN=... ก่อน start

หลังตั้ง env แล้วต้อง restart n8n
"""
import sys, json, re
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบจองคนขับรถ (PostgreSQL) (6).json")
wf = json.loads(dst.read_text(encoding='utf-8'))

ENV_EXPR = '={{ "Bearer " + $env.LINE_ACCESS_TOKEN }}'
BEARER_HARDCODE = re.compile(r'^Bearer\s+[A-Za-z0-9+/=]{50,}$')

changed = []
for node in wf['nodes']:
    if node.get('type') != 'n8n-nodes-base.httpRequest':
        continue
    url = node.get('parameters', {}).get('url', '')
    if 'api.line.me' not in url:
        continue
    headers = node['parameters'].get('headerParameters', {}).get('parameters', [])
    for h in headers:
        if h.get('name') != 'Authorization':
            continue
        old = h.get('value', '')
        if old == ENV_EXPR:
            continue  # already migrated
        if BEARER_HARDCODE.match(old):
            h['value'] = ENV_EXPR
            changed.append(node['name'])
            break

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')

if changed:
    print(f'OK: migrated {len(changed)} node(s)')
    for name in changed:
        print(f'  - {name}')
    print()
    print('ต่อไป — ตั้ง env var ใน n8n:')
    print('  LINE_ACCESS_TOKEN=Podpt9CcFDivS7l53sWv7EiN... (ค่าจากเดิม)')
    print('  แล้ว restart n8n')
else:
    print('ไม่มี node ที่ต้อง migrate (อาจ migrate ไปแล้ว)')
