@echo off
setlocal
title ClipForge AI - Local Agent
cd /d "%~dp0"

echo.
echo ==========================================
echo       CLIPFORGE AI - LOCAL AGENT
echo ==========================================
echo.

REM Check Python
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m venv .venv
  if errorlevel 1 goto python_fallback
  goto install
)

:python_fallback
where python >nul 2>nul
if errorlevel 1 (
  echo Python belum terpasang.
  echo Install Python 3.11 atau 3.12 dari https://www.python.org/downloads/
  echo Saat instalasi, centang "Add Python to PATH".
  echo Setelah selesai, jalankan file ini lagi.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 (
    echo Gagal membuat virtual environment.
    pause
    exit /b 1
  )
)

:install
echo [1/3] Menyiapkan Python environment...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
  echo Gagal memperbarui pip. Periksa koneksi internet.
  pause
  exit /b 1
)

echo.
echo [2/3] Memasang kebutuhan Local Agent...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Gagal memasang dependencies.
  pause
  exit /b 1
)

if not exist ".env" (
  if not exist ".env.example" (
    echo File .env.example tidak ditemukan.
    pause
    exit /b 1
  )
  copy ".env.example" ".env" >nul
  echo.
  echo File konfigurasi .env baru dibuat.
  echo Sekarang Notepad akan terbuka. Isi secret yang baru dari Cloudflare.
  start /wait notepad.exe ".env"
  echo.
  echo Setelah menyimpan .env, tekan tombol apa saja untuk melanjutkan.
  pause >nul
)

findstr /C:"replace-with-the-same-secret-configured-in-Cloudflare" ".env" >nul
if not errorlevel 1 (
  echo.
  echo SECRET BELUM DIISI!
  echo Buka file agent\.env, ganti nilai CLIPFORGE_AGENT_SECRET,
  echo lalu simpan. Secret harus sama dengan AGENT_SHARED_SECRET di Cloudflare.
  start notepad.exe ".env"
  pause
  exit /b 1
)

echo.
echo [3/3] Menjalankan ClipForge Local Agent...
echo Biarkan jendela ini tetap terbuka selama agent digunakan.
echo Tekan CTRL+C untuk menghentikan agent.
echo.
".venv\Scripts\python.exe" agent.py
echo.
echo Agent berhenti. Jika ada error, catat pesannya.
pause
