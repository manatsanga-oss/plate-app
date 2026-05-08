"""
แก้ logic การดึงค่า tax (และ field อื่นๆ ที่อาจมีปัญหาเดียวกัน):
- เดิม: COALESCE(x.tax, e.monthly_tax, 0) → ถ้า x.tax = 0 ใช้ 0 (ไม่ดู default)
- ใหม่: COALESCE(NULLIF(x.tax, 0), e.monthly_tax, 0) → ถ้า x.tax = 0 ใช้ default
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/HR API (3) - diligence_resolved.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))
target = next(n for n in wf['nodes'] if n['name'] == 'Code Calc Payroll')
code = target['parameters']['jsCode']

# tax: ใช้ override ก่อน ถ้า = 0 ให้ดู default
old_tax = "COALESCE(x.tax, e.monthly_tax, 0) AS tax"
new_tax = "COALESCE(NULLIF(x.tax, 0), e.monthly_tax, 0) AS tax"

if old_tax in code:
    code = code.replace(old_tax, new_tax)
    print("OK: changed tax to NULLIF override")
else:
    print("WARN: tax pattern not found — may already be patched")

target['parameters']['jsCode'] = code
dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved to {dst}")
