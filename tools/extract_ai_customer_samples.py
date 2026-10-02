# คัดตัวอย่างคำถามลูกค้าจริง (export ข้อความ LINE/Facebook) → ไฟล์ตัวอย่างให้ "ลูกค้าจำลอง" ของ ai-reception-api ใช้เป็นแนวการถาม
# ใช้: python extract_ai_customer_samples.py "C:\...\all-messages-2026-10-02.csv"
# ผลลัพธ์เก็บนอก repo (OneDrive\New folder\AI_Reception_Customer_Samples.json) เพราะเป็นข้อความลูกค้าจริง — ตัดเบอร์โทร/ข้อความภายในร้านออก
import csv, io, json, os, re, sys, collections

src = sys.argv[1]
OUT = os.path.join(os.environ["USERPROFILE"], "OneDrive", "New folder", "AI_Reception_Customer_Samples.json")
rows = list(csv.reader(io.open(src, encoding="utf-8-sig", newline="")))[1:]

ASK = re.compile(r"ไหม|มั้ย|ไม๊|เท่าไ|กี่|ยังไง|อย่างไร|อะไร|หรือ|หรอ|เหรอ|รึ|\?|ได้ไม|ขอ|สอบถาม|ราคา|ผ่อน|ดาวน์|งวด|เอกสาร|มีของ|ป้าย|ทะเบียน|จอง|เปิด|ปิด|สี")
INTERNAL = re.compile(r"ป\.เปา|สิงห์ชัย|เฮีย|ลัง|สาขา.*จัด|แก้แล้ว|ใส่ช่อง|\[เบอร์โทร\]|Myanmar|http|@")
THAI = re.compile(r"[ก-๙]")
TOPICS = [("ราคา", r"ราคา|เท่าไ|งบ"), ("ผ่อน/ดาวน์/ค่างวด", r"ผ่อน|ดาวน์|งวด|ดอกเบี้ย|ตาราง"), ("เอกสารออกรถ", r"เอกสาร|อายุ|ผู้ปกครอง|ค้ำ"),
          ("เครดิต/แบล็คลิสต์", r"เครดิต|เคดิต|แบล็ค|BL|ติดคืน|บูโร"), ("สี/รุ่นย่อย/มีของไหม", r"สี|มีของ|มีรถ|ตัว ?abs|ตัว ?cbs|สต๊อก|สต็อก|พร้อมส่ง"),
          ("จอง/รอรถ/วันรับรถ", r"จอง|รอ|รับรถ|เข้าวัน|กี่วัน|กี่เดือน"), ("ป้าย/ทะเบียน/เล่ม", r"ป้าย|ทะเบียน|เล่ม|พรบ|ภาษี"),
          ("ซ่อม/อะไหล่/เช็กระยะ/ประกัน", r"ซ่อม|อะไหล่|เช็ก|เช็ค|ประกัน|เปลี่ยน|น้ำมัน"), ("เวลาเปิดปิด/แผนที่/สาขา", r"เปิด|ปิด|หยุด|แผนที่|สาขา|อยู่ตรงไหน"),
          ("โปรโมชั่น/ของแถม/ส่วนลด", r"โปร|ของแถม|แถม|ลด|ฟรี"), ("เทิร์น/มือสอง", r"เทิร์น|มือสอง|ขายรถ")]

seen = set(); by_topic = collections.defaultdict(list)
for r in rows:
    if len(r) < 6: continue
    m = re.sub(r"\s+", " ", r[5]).strip()
    if not (8 <= len(m) <= 110) or m in seen: continue
    if not THAI.search(m) or re.search(r"[က-၏]", m) or re.search(r"\d{6,}", m) or INTERNAL.search(m) or not ASK.search(m): continue
    seen.add(m)
    for name, pat in TOPICS:
        if re.search(pat, m, re.I):
            by_topic[name].append(m); break

out = {name: by_topic[name][:40] for name, _ in TOPICS if by_topic[name]}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print("written:", OUT, {k: len(v) for k, v in out.items()})
