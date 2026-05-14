# การตั้ง env var `LINE_ACCESS_TOKEN` ใน n8n

สำคัญ — n8n 1.x **block** การเข้าถึง `$env` ใน expression/code node โดย default ต้องตั้ง 2 ตัว:

```
LINE_ACCESS_TOKEN=Podpt9CcFDivS7l53sWv7EiNdTbcaqVtaCvsM1XrmsBllnQIVgBdpMJ344ZDfqQ6cTVugJRKGxgH0Fk9C+zePJYFYS05VEhAPf4YKkK1ITIkrBluBbuI2YEJSZAKCBX+W7MVSrLpFwxrKIyCG3cxtgdB04t89/1O/w1cDnyilFU=
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

ถ้าลืมตัว `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` → expression `{{ $env.LINE_ACCESS_TOKEN }}` จะคืน `undefined` → LINE push พังเงียบๆ

---

## Step 0 — ดูว่าคุณรัน n8n แบบไหน

SSH เข้า server ที่รัน n8n แล้วลองทีละคำสั่ง:

```bash
# A) Docker
docker ps | grep n8n

# B) PM2
pm2 list | grep n8n

# C) systemd
systemctl status n8n

# D) แค่ npm run / nohup
ps aux | grep n8n
```

ถ้าเปิด n8n ที่ URL อย่าง `https://app.n8n.cloud/...` หรือ subdomain ของ n8n.cloud → **เป็น n8n Cloud** (ดู Step C)

---

## A) Docker / docker-compose

หา folder ที่มี `docker-compose.yml`:

```bash
docker inspect <n8n-container-name> --format '{{.HostConfig.Binds}}'
# ดู path ของ volume → folder docker-compose.yml มักจะอยู่แถวนั้น
```

### ตัวเลือก A1: แก้ docker-compose.yml ตรงๆ

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    environment:
      - LINE_ACCESS_TOKEN=Podpt9CcFDivS7l53sWv7EiNdTbcaqVtaCvsM1XrmsBllnQIVgBdpMJ344ZDfqQ6cTVugJRKGxgH0Fk9C+zePJYFYS05VEhAPf4YKkK1ITIkrBluBbuI2YEJSZAKCBX+W7MVSrLpFwxrKIyCG3cxtgdB04t89/1O/w1cDnyilFU=
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
      # ...env เดิมไว้
```

Restart:
```bash
docker compose down
docker compose up -d
```

### ตัวเลือก A2: ใส่ใน .env (ถ้า compose file ใช้ `env_file:`)

```bash
cd <folder ที่มี docker-compose.yml>
cat >> .env <<'EOF'
LINE_ACCESS_TOKEN=Podpt9CcFDivS7l53sWv7EiNdTbcaqVtaCvsM1XrmsBllnQIVgBdpMJ344ZDfqQ6cTVugJRKGxgH0Fk9C+zePJYFYS05VEhAPf4YKkK1ITIkrBluBbuI2YEJSZAKCBX+W7MVSrLpFwxrKIyCG3cxtgdB04t89/1O/w1cDnyilFU=
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
EOF
docker compose down
docker compose up -d
```

### ตัวเลือก A3: ถ้ารัน `docker run` ตรงๆ (ไม่มี compose)

```bash
# stop container เดิม
docker stop n8n
docker rm n8n

# start ใหม่พร้อม env vars (เก็บ -v option เดิมที่ใช้ mount /home/node/.n8n ไว้)
docker run -d --name n8n \
  -p 5678:5678 \
  -e LINE_ACCESS_TOKEN='Podpt9CcFDivS7l53sWv7EiNdTbcaqVtaCvsM1XrmsBllnQIVgBdpMJ344ZDfqQ6cTVugJRKGxgH0Fk9C+zePJYFYS05VEhAPf4YKkK1ITIkrBluBbuI2YEJSZAKCBX+W7MVSrLpFwxrKIyCG3cxtgdB04t89/1O/w1cDnyilFU=' \
  -e N8N_BLOCK_ENV_ACCESS_IN_NODE=false \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

---

## B) npm + PM2

```bash
# ตำแหน่ง .env ที่ pm2 อ่าน (ขึ้นกับว่า user setup แบบไหน)
# ลองดูที่ ~/.n8n/.env หรือ root project ของ n8n
ls -la ~/.n8n/

# ถ้ายังไม่มี .env สร้างใหม่
cat >> ~/.n8n/.env <<'EOF'
LINE_ACCESS_TOKEN=Podpt9CcFDivS7l53sWv7EiNdTbcaqVtaCvsM1XrmsBllnQIVgBdpMJ344ZDfqQ6cTVugJRKGxgH0Fk9C+zePJYFYS05VEhAPf4YKkK1ITIkrBluBbuI2YEJSZAKCBX+W7MVSrLpFwxrKIyCG3cxtgdB04t89/1O/w1cDnyilFU=
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
EOF

# restart พร้อม reload env
pm2 restart n8n --update-env
```

**ถ้า pm2 ไม่อ่าน .env อัตโนมัติ** ให้ใช้ ecosystem file:

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'n8n',
    script: 'n8n',
    env: {
      LINE_ACCESS_TOKEN: 'Podpt9...',
      N8N_BLOCK_ENV_ACCESS_IN_NODE: 'false',
    },
  }],
};
```

```bash
pm2 restart ecosystem.config.js --update-env
```

---

## B') systemd

```bash
sudo systemctl edit n8n
```

เพิ่ม override:
```
[Service]
Environment="LINE_ACCESS_TOKEN=Podpt9CcFDivS7l53sWv7EiNdTbcaqVtaCvsM1XrmsBllnQIVgBdpMJ344ZDfqQ6cTVugJRKGxgH0Fk9C+zePJYFYS05VEhAPf4YKkK1ITIkrBluBbuI2YEJSZAKCBX+W7MVSrLpFwxrKIyCG3cxtgdB04t89/1O/w1cDnyilFU="
Environment="N8N_BLOCK_ENV_ACCESS_IN_NODE=false"
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart n8n
```

---

## C) n8n Cloud

Cloud free/starter **ไม่รองรับ env var** (ฟีเจอร์ Variables เป็น Enterprise เท่านั้น)

แนะนำใช้ **n8n Credentials** แทน — ปลอดภัยกว่า hardcode ด้วย:

1. n8n UI → Credentials → New credential
2. เลือก **Header Auth**
3. ตั้งค่า:
   - Name (ใน credential): `LINE Bearer`
   - Name (header): `Authorization`
   - Value: `Bearer Podpt9CcFDivS7l53sWv7EiNdTbcaqVtaCvsM1XrmsBllnQIVgBdpMJ344ZDfqQ6cTVugJRKGxgH0Fk9C+zePJYFYS05VEhAPf4YKkK1ITIkrBluBbuI2YEJSZAKCBX+W7MVSrLpFwxrKIyCG3cxtgdB04t89/1O/w1cDnyilFU=`
4. เปิดทีละ HTTP node ที่ยิงไป LINE (3 nodes): `HTTP Request LINE Booking`, `HTTP LINE Push Confirm`, `HTTP LINE Push Flex`
5. เปลี่ยน Authentication = **Generic Credential Type** → Generic Auth Type = **Header Auth** → เลือก credential `LINE Bearer`
6. ลบ Authorization ใน Header Parameters (ที่เคยใส่ไว้ใน expression)
7. Save → ไม่ต้อง restart (cloud reload เอง)

ทำแบบนี้ token จะถูกเก็บ encrypted ใน n8n ไม่อยู่ใน workflow JSON ที่ export ออกมา (ปลอดภัยกว่า env var ด้วยซ้ำ)

---

## ตรวจว่า env ทำงานหรือยัง

หลัง restart แล้ว สร้าง workflow ทดสอบเล็กๆ:

1. Add **Code** node:
   ```js
   return [{ json: { token: $env.LINE_ACCESS_TOKEN ? 'OK len=' + $env.LINE_ACCESS_TOKEN.length : 'MISSING' } }];
   ```
2. รัน Manual Trigger → ดู output

- ขึ้น `OK len=171` → ใช้ได้
- ขึ้น `MISSING` หรือ undefined → ลืมตั้ง `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` หรือ restart ไม่สำเร็จ

---

## ตรวจหลัง deploy

หลังตั้ง env แล้วลองยิง action เก่าที่ใช้ LINE token เช่น `notify_line`:

```bash
curl -X POST 'https://YOUR-N8N/webhook/booking-api' \
  -H 'Content-Type: application/json' \
  -d '{"action":"notify_line","message":"test env var"}'
```

ถ้าได้ข้อความใน LINE group = LINE_ACCESS_TOKEN ทำงาน

ถ้าใน LINE ไม่ขึ้น → เปิด n8n Executions → ดู node "HTTP Request LINE Booking" → ตรวจ Authorization header → ถ้าเป็น `Bearer undefined` แปลว่า env ยังไม่ active
