@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" pythonw tools\extract_pdf_gui.py
exit
