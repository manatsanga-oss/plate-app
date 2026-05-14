"""
เพิ่ม action `send_booking_flex` ใน n8n workflow ระบบจองคนขับรถ
รับข้อมูลงานจอง → ส่ง Flex Message พร้อมปุ่ม "ยืนยันถึงที่หมาย" (ชี้ไป LIFF) เข้า LINE chat

Node chain:
  Switch[send_booking_flex]
    → Code Build Flex
    → HTTP LINE Push Flex
    → Respond Send Flex
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบจองคนขับรถ (PostgreSQL) (6).json")
wf = json.loads(dst.read_text(encoding='utf-8'))

# reuse LINE token + group id จาก HTTP Request LINE Booking
line_auth_header = None
line_group_id = "C4a99eff6b6096a29086ec4bad98edc2d"
for n in wf['nodes']:
    if n.get('name') == 'HTTP Request LINE Booking':
        for h in n['parameters'].get('headerParameters', {}).get('parameters', []):
            if h.get('name') == 'Authorization':
                line_auth_header = h['value']

LIFF_BASE = 'https://liff.line.me/2010078995-AXJ1tdUa'

# JS โค้ดสร้าง Flex Message
BUILD_FLEX_JS = r"""
const b = $input.first().json.body || {};
const LIFF = 'https://liff.line.me/2010078995-AXJ1tdUa';
const bookingId = String(b.bookingId || b.booking_id || '');
const destLat = b.destLat ?? b.dest_lat ?? '';
const destLng = b.destLng ?? b.dest_lng ?? '';
const destShort = b.destination || '';
const destFull = b.destination_formatted || destShort || '-';
const bookerName = b.booker_name || b.bookerName || '-';
const branch = b.branch || '';
const bookingDate = b.booking_date || b.bookingDate || '-';
const bookingTime = b.booking_time || b.bookingTime || '-';
const carModel = b.car_model || b.carModel || '';
const finance = b.finance_company || b.financeCompany || '';
const driver = b.driver_name || b.driverName || '-';
const purpose = b.purpose || '';
const distance = b.distance_text || b.distanceText || '';
const duration = b.duration_text || b.durationText || '';
const groupId = b.groupId || b.group_id || null;

if (!bookingId) throw new Error('missing bookingId');

const uri = LIFF + '?bookingId=' + encodeURIComponent(bookingId)
  + (destLat !== '' && destLng !== ''
       ? '&destLat=' + encodeURIComponent(destLat) + '&destLng=' + encodeURIComponent(destLng)
       : '')
  + (destFull && destFull !== '-' ? '&destName=' + encodeURIComponent(destFull) : '');

const row = (label, value) => ({
  type: 'box', layout: 'baseline', spacing: 'sm',
  contents: [
    { type: 'text', text: label, color: '#888888', size: 'sm', flex: 3 },
    { type: 'text', text: String(value || '-'), wrap: true, color: '#333333', size: 'sm', flex: 7 },
  ],
});

const bodyRows = [];
bodyRows.push(row('ผู้จอง', bookerName));
if (branch) bodyRows.push(row('ร้านที่จอง', branch));
bodyRows.push(row('วันที่', bookingDate));
bodyRows.push(row('เวลา', bookingTime));
if (carModel) bodyRows.push(row('รุ่น', carModel));
if (finance) bodyRows.push(row('ไฟแนนซ์', finance));
bodyRows.push(row('คนขับ', driver));
if (purpose) bodyRows.push(row('วัตถุประสงค์', purpose));
if (destShort && destShort !== destFull) bodyRows.push(row('สถานที่ส่ง', destShort));
bodyRows.push(row('ที่อยู่', destFull));
if (distance) bodyRows.push(row('ระยะทาง', distance));
if (duration) bodyRows.push(row('เวลาเดินทาง', duration));

const flex = {
  type: 'bubble',
  size: 'mega',
  header: {
    type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#06C755',
    contents: [
      { type: 'text', text: '🚗 งานส่งรถ', color: '#FFFFFF', weight: 'bold', size: 'lg' },
      { type: 'text', text: '#' + bookingId, color: '#FFFFFF', size: 'sm' },
    ],
  },
  body: {
    type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
    contents: bodyRows,
  },
  footer: {
    type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
    contents: [
      {
        type: 'button', style: 'primary', color: '#06C755', height: 'sm',
        action: { type: 'uri', label: '✅ ยืนยันถึงที่หมาย', uri: uri },
      },
    ],
  },
};

return [{ json: {
  to: groupId || '__DEFAULT_GROUP__',
  altText: '🚗 งานส่งรถ #' + bookingId + ' • ' + destFull,
  flex: flex,
} }];
"""

# JSON body สำหรับ LINE push (จะใช้ค่า to จาก output ของ Code Build Flex)
# ถ้า to === '__DEFAULT_GROUP__' → fallback ไป group id
PUSH_BODY = (
    '={\n'
    '  "to": "{{ $json.to === \'__DEFAULT_GROUP__\' ? \'' + line_group_id + '\' : $json.to }}",\n'
    '  "messages": [{\n'
    '    "type": "flex",\n'
    '    "altText": {{ JSON.stringify($json.altText) }},\n'
    '    "contents": {{ JSON.stringify($json.flex) }}\n'
    '  }]\n'
    '}\n'
)

# ============== เพิ่ม switch rule ==============
sw = next(n for n in wf['nodes']
          if n.get('name') == 'Switch' and n.get('type') == 'n8n-nodes-base.switch')
rules = sw['parameters']['rules']['values']

KEY = 'send_booking_flex'
if not any(r.get('outputKey') == KEY for r in rules):
    rules.append({
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": str(uuid.uuid4()),
                "leftValue": "={{ $json.body.action }}",
                "rightValue": KEY,
                "operator": {"type": "string", "operation": "equals"},
            }],
            "combinator": "and",
        },
        "renameOutput": True,
        "outputKey": KEY,
    })

rule_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == KEY)

# ============== เพิ่ม nodes ==============
existing = {n['name']: n for n in wf['nodes']}
base_x, base_y = 5760, 8260

def upsert_node(name, factory):
    if name in existing:
        return existing[name]
    node = factory()
    wf['nodes'].append(node)
    existing[name] = node
    return node

n_build = upsert_node('Code Build Flex', lambda: {
    "parameters": {"jsCode": BUILD_FLEX_JS},
    "type": "n8n-nodes-base.code", "typeVersion": 2,
    "position": [base_x, base_y],
    "id": str(uuid.uuid4()), "name": "Code Build Flex",
})
n_build['parameters']['jsCode'] = BUILD_FLEX_JS

n_push = upsert_node('HTTP LINE Push Flex', lambda: {
    "parameters": {
        "method": "POST",
        "url": "https://api.line.me/v2/bot/message/push",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "Authorization",
             "value": line_auth_header or "Bearer REPLACE_WITH_CHANNEL_ACCESS_TOKEN"},
        ]},
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": PUSH_BODY,
        "options": {},
    },
    "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
    "position": [base_x + 240, base_y],
    "id": str(uuid.uuid4()), "name": "HTTP LINE Push Flex",
})
n_push['parameters']['jsonBody'] = PUSH_BODY

n_respond = upsert_node('Respond Send Flex', lambda: {
    "parameters": {
        "respondWith": "json",
        "responseBody": '={{ JSON.stringify({ ok: true, status: $input.first().json.status || 200 }) }}',
        "options": {"responseHeaders": {"entries": [
            {"name": "Access-Control-Allow-Origin", "value": "*"},
            {"name": "Access-Control-Allow-Methods", "value": "POST, OPTIONS"},
            {"name": "Access-Control-Allow-Headers", "value": "Content-Type"},
        ]}},
    },
    "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
    "position": [base_x + 480, base_y],
    "id": str(uuid.uuid4()), "name": "Respond Send Flex",
})

# ============== ต่อ connections ==============
connections = wf.setdefault('connections', {})
sw_conns = connections.setdefault('Switch', {}).setdefault('main', [])
while len(sw_conns) <= rule_idx:
    sw_conns.append([])
if not any(t.get('node') == 'Code Build Flex' for t in sw_conns[rule_idx]):
    sw_conns[rule_idx].append({"node": "Code Build Flex", "type": "main", "index": 0})

connections['Code Build Flex'] = {
    "main": [[{"node": "HTTP LINE Push Flex", "type": "main", "index": 0}]]
}
connections['HTTP LINE Push Flex'] = {
    "main": [[{"node": "Respond Send Flex", "type": "main", "index": 0}]]
}

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("OK: send_booking_flex action wired")
print(f"  - switch rule index: {rule_idx}")
print(f"  - nodes: Code Build Flex, HTTP LINE Push Flex, Respond Send Flex")
print(f"  - LIFF URL base: {LIFF_BASE}")
print(f"  - default LINE group id: {line_group_id}")
print(f"  - LINE auth header: {'reused' if line_auth_header else 'PLACEHOLDER'}")
