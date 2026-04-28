# -*- coding: utf-8 -*-
import pdfplumber, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
PDF = r'C:\Users\manat\OneDrive\ระบบงาน 4\งบการเงินปี 2568\งบทดลองสช.pdf'
num_pat = r'-?[\d,]+\.\d{2}'
with pdfplumber.open(PDF) as pdf:
    for i, page in enumerate(pdf.pages):
        txt = page.extract_text() or ""
        print(f"--- page {i+1} ---")
        for line in txt.split('\n'):
            nums = re.findall(num_pat, line)
            m = re.match(r'^\s*(\d{4,6})', line)
            if m and len(nums) >= 6:
                code = m.group(1)
                # show code + all numbers
                print(f"  {code}: {nums}")
            elif len(nums) >= 6:
                # possible totals line without code
                print(f"  [no-code]: first60={line[:60]!r} nums={nums}")
