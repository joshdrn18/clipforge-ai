@echo off
setlocal
title ClipForge AI - Local Agent
cd /d "%~dp0"

echo.
echo ==========================================
echo       CLIPFORGE AI - LOCAL AGENT
echo ==========================================
echo.

REM AutoClip currently requires Python 3.11 or 3.12.
if not exist ".venv\Scripts\python.exe" goto create_venv
".venv\Scripts\python.exe" -c "import sys; raise SystemExit(0 if sys.version_info[:2] in ((3,11),(3,12)) else 1)" >nul 2>nul
if errorlevel 1 (
  echo Existing Python environment is not Python 3.11 or 3.12.
  rmdir /s /q ".venv"
  goto create_venv
)
goto install

:create_venv
where py >nul 2>nul
if errorlevel 1 (
  echo Python Launcher (py) was not found.
  echo Install Python 3.12 or 3.11 from https://www.python.org/downloads/
  echo Keep the Python Launcher option enabled during setup.
  pause
  exit /b 1
)
echo Checking for Python 3.12...
py -3.12 -m venv .venv
if errorlevel 1 (
  echo Python 3.12 not found. Trying Python 3.11...
  py -3.11 -m venv .venv
)
if errorlevel 1 (
  echo.
  echo ClipForge needs Python 3.11 or 3.12. Python 3.13 is not supported by the planned video engine.
  echo Install Python 3.12, then double-click this file again.
  pause
  exit /b 1
)

:install
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo Full FFmpeg is required by the video renderer.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Windows Package Manager was not found.
    echo Install the full Gyan FFmpeg build from https://www.gyan.dev/ffmpeg/builds/
    pause
    exit /b 1
  )
  echo Installing the full Gyan FFmpeg build...
  winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
  echo.
  echo Close this window and double-click START-CLIPFORGE.bat again so Windows refreshes PATH.
  pause
  exit /b 0
)

echo [1/3] Preparing Python environment...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
  echo Could not update pip. Check your internet connection.
  pause
  exit /b 1
)

echo.
echo [2/3] Installing Local Agent requirements...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Could not install dependencies.
  pause
  exit /b 1
)

if not exist ".env" (
  if not exist ".env.example" (
    echo .env.example was not found.
    pause
    exit /b 1
  )
  copy ".env.example" ".env" >nul
  echo.
  echo A new .env configuration file was created.
  echo Notepad will open. Enter the rotated secret from Cloudflare.
  start /wait notepad.exe ".env"
  echo.
  echo Save .env, then press any key to continue.
  pause >nul
)

findstr /C:"replace-with-the-same-secret-configured-in-Cloudflare" ".env" >nul
if not errorlevel 1 (
  echo.
  echo SECRET IS NOT CONFIGURED.
  echo Replace CLIPFORGE_AGENT_SECRET in agent\.env with the same new value as Cloudflare AGENT_SHARED_SECRET.
  start notepad.exe ".env"
  pause
  exit /b 1
)

echo.
echo Checking AutoClip engine, FFmpeg, and AI provider...
".venv\Scripts\autoclip.exe" doctor
if errorlevel 1 (
  echo.
  echo Renderer is not ready yet.
  echo Run CONFIGURE-AI.bat to add an AI provider, then CHECK-CLIPFORGE.bat.
  pause
  exit /b 1
)

echo.
echo [3/3] Starting ClipForge Local Agent...
echo Keep this window open while the agent is connected.
echo Press CTRL+C to stop the agent.
echo.
".venv\Scripts\python.exe" agent.py
echo.
echo Agent stopped. If an error appeared, take a screenshot of this window.
pause
