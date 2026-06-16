@echo off
chcp 65001 >nul
REM ลากไฟล์ PDF สมุดรูปภาพชุดสี วางบนไฟล์นี้ได้เลย (drag & drop)
REM หรือดับเบิลคลิกแล้วพิมพ์ path เอง

setlocal
cd /d "%~dp0\.."

if "%~1"=="" (
  set /p PDFPATH="ลากไฟล์ PDF มาวาง หรือพิมพ์ path ของ PDF: "
) else (
  set "PDFPATH=%~1"
)

echo.
python tools\build_color_book.py "%PDFPATH%"

echo.
echo ============================================================
echo  ถ้าขึ้น "เสร็จส่วนอัตโนมัติแล้ว" = สำเร็จ
echo  ขั้นต่อไป: เปิด Claude แล้วบอกว่า "เติมชื่อรุ่น <slug>"
echo ============================================================
pause
