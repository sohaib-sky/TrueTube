@echo off
REM ============================================================
REM  TrueTube - Start the site and open it on the internet
REM  Double-click this file. It prints a public address.
REM ============================================================
title TrueTube - Go Live
setlocal enabledelayedexpansion
cd /d "%~dp0.."

echo.
echo   Starting TrueTube...
echo.

REM The public tunnel is a reverse proxy, so every request carries
REM X-Forwarded-For. Without TRUST_PROXY the rate limiter cannot identify a
REM client and fails the request, which showed up to visitors as a dead site.
REM The server is always started behind the tunnel from this script, so trust
REM the first hop. (Start TrueTube.bat, used with no tunnel, leaves it off.)
set "TRUST_PROXY=true"

REM --- 1. is the API server already up? ---
powershell -NoProfile -Command ^
  "try { $null = Invoke-RestMethod 'http://localhost:5000/api/health' -TimeoutSec 5; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  echo   [1/2] Server already running.
) else (
  echo   [1/2] Starting server...
  start "TrueTube Server" /min cmd /c "node server\src\server.js --production >> .runtime\server.log 2>> .runtime\server.err"
  REM give it time to detect yt-dlp and ffmpeg
  set /a tries=0
  :wait
  powershell -NoProfile -Command ^
    "try { $null = Invoke-RestMethod 'http://localhost:5000/api/health' -TimeoutSec 5; exit 0 } catch { exit 1 }"
  if !errorlevel!==0 goto ready
  set /a tries+=1
  if !tries! GEQ 12 (
    echo.
    echo   Server did not start. Check .runtime\server.err
    pause
    exit /b 1
  )
  ping -n 3 127.0.0.1 > nul
  goto wait
)
:ready
echo         Server is healthy.

REM --- cloudflared is located by run-tunnel.bat, which reports a clear
REM     error into .runtime\tunnel.err if it is missing. ---

REM --- 2. is a tunnel already up? ---
for /f "tokens=* delims=" %%u in ('powershell -NoProfile -Command ^
  "$l = Get-Content .runtime\tunnel.err -Raw -ErrorAction SilentlyContinue; if ($l) { [regex]::Match($l,'https://[a-z0-9-]+\.trycloudflare\.com').Value }"') do set "URL=%%u"

if defined URL (
  echo   [2/2] Tunnel already running.
) else (
  echo   [2/2] Creating public address, please wait...
  REM The tunnel runs from its own script: a quoted path with spaces inside
  REM `start ... cmd /c "..."` breaks cmd quote parsing.
  start "TrueTube Tunnel" /min cmd /c "%~dp0run-tunnel.bat"
  set /a tries=0
  :twait
  for /f "tokens=* delims=" %%u in ('powershell -NoProfile -Command ^
    "$l = Get-Content .runtime\tunnel.err -Raw -ErrorAction SilentlyContinue; if ($l) { [regex]::Match($l,'https://[a-z0-9-]+\.trycloudflare\.com').Value }"') do set "URL=%%u"
  if defined URL goto goturl
  set /a tries+=1
  if !tries! GEQ 15 goto fail
  ping -n 3 127.0.0.1 > nul
  goto twait
)
:goturl
:fail

REM The tunnel dies on its own — localtunnel dropped a 2.9 MB transfer mid
REM stream, and its own server answers 503 now and then. The watcher restarts it
REM on the same pinned subdomain, so the address stops changing.
echo.
echo   Starting the address watchdog...
start "TrueTube Watchdog" /min cmd /c "%~dp0watchdog-start.bat"

echo.
echo   ============================================
if defined URL (
  echo    TrueTube is live at:
  echo.
  echo      %URL%
  echo.
  echo   ============================================
  echo.
  echo   This address works while this computer is on
  echo   and the program is running. Closing this
  echo   window stops the public address.
  echo.
  start "" "%URL%"
) else (
  echo    Could not create a public address.
  echo    Is cloudflared installed? Run: winget install Cloudflare.cloudflared
  echo.
)
echo   Press any key to close. Do not close the
echo   two small windows in the taskbar, or the site stops.
echo.
pause > nul
