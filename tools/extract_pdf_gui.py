# -*- coding: utf-8 -*-
"""
GUI สำหรับแปลง PDF Honda Parts List → SQL Service Rate (FRT)
ดับเบิ้ลคลิก extract_pdf.bat (หรือรัน: python tools/extract_pdf_gui.py)
"""
import os, re, sys, threading, subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_service_frt import extract, esc, OUT_DIR

PAT_FILENAME_PAREN = re.compile(
    r"PL-([A-Za-z0-9_\s]+?)-\(([A-Za-z0-9_]+)\)\.pdf", re.IGNORECASE
)
PAT_FILENAME_NOPAREN = re.compile(
    r"PL-([A-Za-z0-9_\s]+?)-([A-Za-z0-9_]+)\.pdf", re.IGNORECASE
)
# pattern ของ Honda code บนหน้า 1 ของ PDF: เลข เลข [CODE 4 ตัว] ตัวอักษร เลข ตัวอักษร
# ตัวอย่าง: "1 3 K2JT T 1 TH" / "1 3 K93F T 1 AP" / "1 3 KZYA T 1 TH"
PAT_PDF_CODE = re.compile(
    r"\b\d\s+\d\s+([A-Z][A-Z0-9]{3,5})\s+[A-Z]\s+\d\s+[A-Z]+"
)


def normalize_model(name):
    # ตัด space ในชื่อรุ่น (เช่น "SCOOPY I" → "SCOOPYI") แล้วแปลง I ท้ายเป็น i เล็ก
    s = re.sub(r"\s+", "", name).upper()
    return re.sub(r"I$", "i", s)


def detect_from_pdf(path):
    """อ่าน MODEL และ CODE จากหน้า 1 ของ PDF (เชื่อถือได้กว่าชื่อไฟล์)"""
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            text = pdf.pages[0].extract_text() or ""
        lines = [l.strip() for l in text.split("\n")[:10] if l.strip()]
        # MODEL — ปกติอยู่บรรทัดที่ 2 (หลัง "คู่มือรายการอะไหล่")
        model = ""
        for l in lines:
            if l.startswith("คู่มือ") or l.startswith("Parts"):
                continue
            # บรรทัดที่เป็นชื่อรุ่น (มีตัวอักษร, ไม่มี dots/many digits)
            if re.match(r"^[A-Za-z][A-Za-z0-9\s]{2,30}$", l) and not PAT_PDF_CODE.search(l):
                model = normalize_model(l)
                break
        # CODE — หาจาก pattern "1 3 XXXX T 1 TH"
        code = ""
        for l in lines:
            m = PAT_PDF_CODE.search(l)
            if m:
                code = m.group(1)
                break
        return model, code
    except Exception:
        return "", ""


def detect_model_code(path):
    # 1) priority แรก = อ่านจาก PDF (เชื่อถือได้สุด)
    m_pdf, c_pdf = detect_from_pdf(path)
    if m_pdf and c_pdf:
        return m_pdf, c_pdf
    # 2) fallback = parse จากชื่อไฟล์
    name = os.path.basename(path)
    m = PAT_FILENAME_PAREN.search(name)
    if m:
        return m_pdf or normalize_model(m.group(1)), c_pdf or m.group(2).upper()
    m = PAT_FILENAME_NOPAREN.search(name)
    if m:
        return m_pdf or normalize_model(m.group(1)), c_pdf or m.group(2).upper()
    return m_pdf, c_pdf


def write_sql(path, model, model_code, sections, rows):
    out = os.path.join(OUT_DIR, f"Service_Flat_Rate_{model}_Inserts.sql")
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"-- ข้อมูล FRT จาก {os.path.basename(path)} (generate อัตโนมัติ)\n")
        f.write(
            f"DELETE FROM service_flat_rates WHERE model = '{model}' "
            f"AND model_code = '{model_code}';\n"
        )
        for sec, ref, part_no, th, en, qty, hrs in rows:
            s = sections.get(sec, {"th": "", "en": ""})
            vals = [
                f"'{model}'",
                f"'{model_code}'",
                f"'{sec}'",
                f"'{esc(s['th'])}'",
                f"'{esc(s['en'])}'",
                str(ref) if ref is not None else "NULL",
                f"'{part_no}'" if part_no else "NULL",
                f"'{esc(th)}'" if th else "NULL",
                f"'{esc(en)}'" if en else "NULL",
                str(qty) if qty is not None else "NULL",
                str(hrs) if hrs is not None else "NULL",
            ]
            f.write(
                "INSERT INTO service_flat_rates "
                "(model, model_code, section_code, section_name, section_name_en, "
                "ref_no, part_no, part_name, part_name_en, qty, frt_hours) "
                "VALUES (" + ", ".join(vals) + ");\n"
            )
    return out


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("📤 แปลง PDF Honda → SQL Service Rate (FRT)")
        self.geometry("760x620")
        self.minsize(640, 520)

        self.pdf_path = tk.StringVar()
        self.model = tk.StringVar()
        self.model_code = tk.StringVar()
        self.last_sql_path = None

        self._build()

    def _build(self):
        pad = {"padx": 12, "pady": 8}

        # Section 1: choose file
        frm1 = ttk.LabelFrame(self, text="1. เลือกไฟล์ PDF (Honda Parts List)")
        frm1.pack(fill="x", **pad)
        ttk.Button(frm1, text="📂 เลือกไฟล์ PDF...", command=self.pick_pdf).pack(
            side="left", padx=8, pady=8
        )
        ttk.Entry(frm1, textvariable=self.pdf_path, state="readonly").pack(
            side="left", fill="x", expand=True, padx=8, pady=8
        )

        # Section 2: model/code
        frm2 = ttk.LabelFrame(self, text="2. ข้อมูลรุ่น (auto-detect จากชื่อไฟล์)")
        frm2.pack(fill="x", **pad)
        row = ttk.Frame(frm2)
        row.pack(fill="x", padx=8, pady=8)
        ttk.Label(row, text="MODEL:").pack(side="left")
        ttk.Entry(row, textvariable=self.model, width=20).pack(side="left", padx=6)
        ttk.Label(row, text="MODEL_CODE:").pack(side="left", padx=(20, 0))
        ttk.Entry(row, textvariable=self.model_code, width=15).pack(side="left", padx=6)
        ttk.Label(
            frm2,
            text="ตัวอย่าง: PCX150 / KZYA · WAVE110i / KWWA · CLICK125i / KZRA",
            foreground="#64748b",
            font=("Segoe UI", 9),
        ).pack(anchor="w", padx=8, pady=(0, 8))

        # Section 3: action
        frm3 = ttk.LabelFrame(self, text="3. แปลงเป็น SQL")
        frm3.pack(fill="x", **pad)
        btns = ttk.Frame(frm3)
        btns.pack(fill="x", padx=8, pady=8)
        self.run_btn = ttk.Button(btns, text="🚀 แปลงเป็น SQL", command=self.run_extract)
        self.run_btn.pack(side="left")
        self.open_btn = ttk.Button(
            btns, text="📁 เปิดโฟลเดอร์ผลลัพธ์", command=self.open_folder, state="disabled"
        )
        self.open_btn.pack(side="left", padx=8)
        ttk.Button(btns, text="❌ ปิด", command=self.destroy).pack(side="right")

        # Section 4: log
        frm4 = ttk.LabelFrame(self, text="ผลลัพธ์")
        frm4.pack(fill="both", expand=True, **pad)
        self.log = scrolledtext.ScrolledText(
            frm4, wrap="word", height=12, font=("Consolas", 10)
        )
        self.log.pack(fill="both", expand=True, padx=8, pady=8)
        self._println(
            "พร้อมใช้งาน — เลือกไฟล์ PDF แล้วกด 'แปลงเป็น SQL'\n"
            f"ผลลัพธ์จะถูกบันทึกที่: {OUT_DIR}\n"
        )

    def _println(self, msg):
        self.log.insert("end", msg + "\n")
        self.log.see("end")
        self.log.update_idletasks()

    def pick_pdf(self):
        path = filedialog.askopenfilename(
            title="เลือกไฟล์ PDF Parts List",
            filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")],
        )
        if not path:
            return
        self.pdf_path.set(path)
        m, c = detect_model_code(path)
        if m:
            self.model.set(m)
            self.model_code.set(c)
            self._println(f"✓ เลือกไฟล์: {os.path.basename(path)}")
            self._println(f"  Auto-detect: MODEL={m}, CODE={c}")
        else:
            self._println(f"✓ เลือกไฟล์: {os.path.basename(path)}")
            self._println(
                "⚠️ ไม่สามารถ auto-detect ได้ — กรอก MODEL และ MODEL_CODE เอง"
            )

    def run_extract(self):
        path = self.pdf_path.get().strip()
        model = self.model.get().strip()
        code = self.model_code.get().strip()

        if not path:
            messagebox.showerror("ผิดพลาด", "ยังไม่ได้เลือกไฟล์ PDF")
            return
        if not os.path.exists(path):
            messagebox.showerror("ผิดพลาด", f"ไม่พบไฟล์: {path}")
            return
        if not model or not code:
            messagebox.showerror("ผิดพลาด", "กรอก MODEL และ MODEL_CODE ก่อน")
            return

        self.run_btn.config(state="disabled", text="⏳ กำลังแปลง...")
        threading.Thread(
            target=self._do_extract, args=(path, model, code), daemon=True
        ).start()

    def _do_extract(self, path, model, code):
        try:
            self._println(f"\n— เริ่มแปลง {os.path.basename(path)} —")
            sections, rows, n_parts, n_jobs = extract(path, model, code)
            out = write_sql(path, model, code, sections, rows)
            self.last_sql_path = out

            with_frt = sum(1 for r in rows if r[6] is not None and r[2])
            job_only = sum(1 for r in rows if r[2] is None)

            self._println(f"✅ สำเร็จ!")
            self._println(f"  Sections (หมวด): {len(sections)}")
            self._println(f"  Parts (อะไหล่): {n_parts} — มี FRT {with_frt}")
            self._println(f"  FRT jobs (งานล้วน): {n_jobs} — ไม่มี part {job_only}")
            self._println(f"  รวม INSERT: {len(rows)} แถว")
            self._println(f"\n📄 บันทึกที่: {out}")
            self._println(
                "\n👉 ขั้นถัดไป: เปิดเว็บ "
                "Service → '📤 นำเข้า FRT (Admin)' "
                "เลือกไฟล์นี้แล้วกด 'นำเข้า'"
            )
            self.after(0, lambda: self.open_btn.config(state="normal"))
        except FileNotFoundError as e:
            self._println(f"❌ ไม่พบไฟล์: {e}")
            messagebox.showerror("ผิดพลาด", str(e))
        except Exception as e:
            self._println(f"❌ เกิดข้อผิดพลาด: {e}")
            messagebox.showerror("ผิดพลาด", f"{type(e).__name__}: {e}")
        finally:
            self.after(0, lambda: self.run_btn.config(state="normal", text="🚀 แปลงเป็น SQL"))

    def open_folder(self):
        target = self.last_sql_path or OUT_DIR
        if os.path.exists(target):
            if os.path.isfile(target):
                subprocess.run(["explorer", "/select,", os.path.normpath(target)])
            else:
                subprocess.run(["explorer", os.path.normpath(target)])
        else:
            messagebox.showinfo("แจ้งเตือน", f"ไม่พบ: {target}")


if __name__ == "__main__":
    try:
        import pdfplumber  # noqa: F401
    except ImportError:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "ขาด library",
            "ไม่พบ pdfplumber\n\nเปิด PowerShell แล้วรัน:\npip install pdfplumber",
        )
        sys.exit(1)

    App().mainloop()
