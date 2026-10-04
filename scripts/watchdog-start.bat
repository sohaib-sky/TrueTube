@echo off
REM ============================================================
REM  TrueTube - keeps the public address alive.
REM  Its own file because it needs a node binary path and a log
REM  file, and inlining that in Go Live.bat runs into the same
REM  quoting problems the tunnel wrapper was split out to avoid.
REM ============================================================
cd /d "%~dp0.."
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" exit /b 1

REM Only one watcher: a second would restart the tunnel underneath the first.
for /f "tokens=2 delims=," %%p in ('wmic process where "name='node.exe'" get processid^,commandline /format:csv 2^>nul ^| find "watchdog.mjs"') do (
  taskkill /PID %%~p /F >nul 2>&1
)

node scripts\watchdog.mjs >> .runtime\watchdog.log 2>> .runtime\watchdog.err
