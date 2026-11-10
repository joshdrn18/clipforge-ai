@echo off
setlocal
title ClipForge AI - Configure Highlight Provider
cd /d "%~dp0"

if not exist ".venv\Scripts\autoclip.exe" (
  echo AutoClip is not installed yet.
  echo Run START-CLIPFORGE.bat first and wait for installation to finish.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   CONFIGURE CLIPFORGE AI HIGHLIGHT MODEL
echo ==========================================
echo.
echo This opens AutoClip's secure provider-key prompt.
echo The key is stored in your local OS keyring when available.
echo It is NOT uploaded to ClipForge or committed to GitHub.
echo.
echo Supported examples: openai, anthropic, gemini
echo.
set /p PROVIDER=Provider name (default openai):
if "%PROVIDER%"=="" set PROVIDER=openai
".venv\Scripts\autoclip.exe" config set-secret %PROVIDER%
echo.
echo Next, run CHECK-CLIPFORGE.bat to verify the renderer.
pause
