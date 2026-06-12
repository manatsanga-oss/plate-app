# คำสั่งสำหรับ Claude Code ใน project นี้

## Git / GitHub

- **ห้าม `git push` โดยอัตโนมัติเด็ดขาด** — ต้องรอให้ user สั่ง "push" หรือ "push to github" ก่อนเท่านั้น
- หลัง commit เสร็จแล้ว ให้แค่แจ้ง user ว่า commit แล้ว ห้าม push เอง
- `git commit` ทำได้เมื่อ user สั่งให้ commit หรือเมื่อบอกชัดว่าให้บันทึก

## สถาปัตยกรรม (Architecture)

- **Frontend:** React + Vite deploy เป็น Render Static Site (`plate-app`), auto-deploy เมื่อ push เข้า `main`. Live: `https://plate-app-y1z1.onrender.com`
- **Backend:** ไม่ได้เขียนเป็นเซิร์ฟเวอร์โค้ดในโปรเจกต์ แต่เป็น **n8n webhook + Postgres** — แต่ละ feature = 1 webhook workflow ที่ switch ตาม `body.action` แล้วคุยกับ Postgres (base: `https://n8n-new-project-gwf2.onrender.com/webhook/<path>`)
- **ทุก feature ใหม่ที่ต้องเก็บข้อมูล** ต้องทำ 3 ส่วน: (1) หน้า/โค้ด frontend, (2) n8n workflow JSON, (3) SQL DDL ของตาราง
  - **Workflow JSON + DDL** เก็บที่ `C:\Users\manat\OneDrive\New folder\` (parent, naming: `*_Workflow.json` / `*_DDL.sql`)
  - **SQL INSERT data** (extracted/bulk inserts) เก็บที่ subfolder `C:\Users\manat\OneDrive\New folder\โฟลเดอร์ใหม่\` (naming: `*_Inserts.sql`)
- หลัง import workflow ใน n8n ต้องตั้ง Postgres credential บน PG nodes + toggle **Active** เอง (production `/webhook/` ใช้ได้เมื่อ active เท่านั้น)
- **n8n: เมื่อมีการแก้ไข logic/SQL ของ workflow ต้องแก้ที่ไฟล์ `*_Workflow.json` ใน `C:\Users\manat\OneDrive\New folder` ให้เสมอ** — ห้ามให้ user copy/paste แก้ใน n8n เอง (ให้แก้ไฟล์จริงทุกครั้ง ส่วน user แค่ re-import หรือ sync จากไฟล์) เก็บไฟล์เป็น source of truth
- **n8n + Postgres ห้ามใส่ตัวอักษร `$` ใน SQL ที่ generate** (เช่น regex `[0-9]+$`) เพราะ Postgres node จะ mangle `$` ทำให้ syntax พัง — เลี่ยงไปใช้ `LIKE` + `SUBSTRING` แทนการ match ด้วย regex
- **หน้าที่: แก้ไข n8n workflow JSON ทั้งหมดใน `C:\Users\manat\OneDrive\New folder` ให้ user ได้โดยตรง** — รวมถึง replace token, secret, group ID, SQL query, node parameters ใด ๆ ที่ user ขอ — user ไม่ต้องการแก้เอง ผู้ช่วยมีหน้าที่แก้ไฟล์ JSON ทุกครั้งที่ขอ
- **LINE OA Token**: ใช้ของ **POR.PAOR MOTOR** (Channel ID เดิม) — เก็บแบบ hardcode `Bearer Podpt9CcFDivS7l53sWv7Ei...` ใน workflow JSON ตรง ๆ ไม่ใช้ env var (user prefer แบบนี้)
- **เคยลองเปลี่ยนเป็น ป.เปามอเตอร์เซอร์วิส แต่ revert กลับ** เพราะ OA ป.เปาเป็น "แชทแบบแมนนวล" (admin ตอบเอง 632 friends) ไม่สามารถเข้ากลุ่มอัตโนมัติได้ และไม่ต้องการเปลี่ยนโหมดเป็นบอท
- **LINE destination Group ID**: `C4a99eff6b6096a29086ec4bad98edc2d` (POR.PAOR อยู่ในกลุ่มนี้)
- รายละเอียดเพิ่มเติมดูใน memory: deploy/backend, ฟีเจอร์ใบเสร็จ QR/LIFF, ฟีเจอร์ขายปลีก
