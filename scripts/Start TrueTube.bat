@echo off
setlocal
title TrueTube
cd /d "%~dp0"

echo.
echo   TrueTube
echo   ==========================================
echo.

rem --- Preconditions ------------------------------------------------------------
rem These are checked up front so a missing piece produces one clear sentence
rem instead of a stack trace the reader has no way to act on.

where node >nul 2>&1
if errorlevel 1 (
  echo   [X] Node.js is not installed on this computer.
  echo.
  echo       TrueTube needs Node.js to run. It is free:
  echo       https://nodejs.org  ^(download the "LTS" version^)
  echo.
  echo       After installing, close this window and open it again.
  echo.
  pause
  exit /b 1
)

if not exist ".tools\yt-dlp.exe" (
  echo   [X] .tools\yt-dlp.exe is missing.
  echo.
  echo       Keep the whole TrueTube folder together - the .tools folder holds
  echo       the program that actually fetches the video.
  echo.
  pause
  exit /b 1
)

if not exist ".tools\ffmpeg.exe" (
  echo   [X] .tools\ffmpeg.exe is missing.
  echo.
  echo       Keep the whole TrueTube folder together - the .tools folder holds
  echo       the program that merges video and audio.
  echo.
  pause
  exit /b 1
)

rem --- Start the server ---------------------------------------------------------
rem Output goes to logs\server.log rather than a second window: if startup fails,
rem the reason has to be readable later, not scrolled away in a minimised title bar.

echo   Starting the server...
if not exist "logs" mkdir "logs"
start "TrueTube" /min cmd /c "node server\src\app.mjs --production >> logs\server.log 2>&1"

rem --- Wait for it to actually answer -------------------------------------------
rem Opening the browser before the server listens gives a connection error, which
rem looks like a broken website rather than a slow start.

set /a TRIES=0
:WAIT
set /a TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 'http://localhost:5000/').StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 goto READY
if %TRIES% lss 45 (
  timeout /t 1 /nobreak >nul
  goto WAIT
)

echo.
echo   [X] The server did not start within 45 seconds.
echo.
echo       The reason is in:  logs\server.log
echo.
echo       Most common causes:
echo         - Another program is already using port 5000. Close it, then
echo           try again.
echo         - Your antivirus blocked node.exe. Allow it and try again.
echo.
pause
exit /b 1

:READY
echo.
echo   ==========================================
echo    TrueTube is running
echo.
echo    Address:  http://localhost:5000
echo    Logs:     logs\server.log
echo   ==========================================
echo.
echo   Opening your browser now...
start "" "http://localhost:5000"
echo.
echo   Keep this window open while you use TrueTube.
echo   Press any key here when you are finished - that stops the server.
echo.
pause >nul

rem --- Shut down ---------------------------------------------------------------
rem Match on the port rather than the image name, so this only ever stops the
rem server this window started and never an unrelated node process.
rem
rem /T matters more than it looks. yt-dlp spawns its own child processes, and
rem killing only the parent leaves them running: they keep pulling bytes with no
rem server to report to, keep the yt-dlp.exe file open so the folder cannot be
copied or rebuilt, and are invisible to the person who just pressed the key.

echo   Stopping the server...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /T /F >nul 2>&1
)
echo   Stopped. You can close this window.
timeout /t 3 /nobreak >nul
exit /b 0
