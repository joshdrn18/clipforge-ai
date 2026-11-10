@echo off
setlocal
title ClipForge AI - Renderer Check
cd /d "%~dp0"

if not exist ".venv\Scripts\autoclip.exe" (
  echo AutoClip is not installed. Run START-CLIPFORGE.bat first.
  pause
  exit /b 1
)

".venv\Scripts\autoclip.exe" doctor
echo.
echo If all required checks pass, start the agent with START-CLIPFORGE.bat.
pause
