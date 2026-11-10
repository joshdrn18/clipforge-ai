@echo off
setlocal
title ClipForge AI - Test Agent Connection
cd /d "%~dp0"

echo.
echo ==========================================
echo    CLIPFORGE AI - AGENT CONNECTION TEST
echo ==========================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo Agent is not installed yet.
  echo Double-click START-CLIPFORGE.bat first and finish installation.
  pause
  exit /b 1
)

if not exist ".env" (
  echo agent\.env is missing.
  echo Run START-CLIPFORGE.bat first to create it.
  pause
  exit /b 1
)

echo Testing Cloudflare API, shared secret, registration and renderer...
".venv\Scripts\python.exe" agent.py --check
if errorlevel 1 (
  echo.
  echo CONNECTION TEST FAILED. Read the error above and send a screenshot.
  pause
  exit /b 1
)

echo.
echo Connection test passed.
pause
