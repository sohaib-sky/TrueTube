@echo off
REM ============================================================
REM  TrueTube - starts only the public tunnel.
REM  Kept as its own file because a path with spaces inside a
REM  quoted `start ... cmd /c "..."` line breaks cmd's own quote
REM  parsing. Here the redirection is local and unambiguous.
REM ============================================================
cd /d "%~dp0.."

REM Locate cloudflared: installed, but not on PATH.
set "CLOUDFLARED="
for %%p in (
  "cloudflared"
  "%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
  "%ProgramFiles%\cloudflared\cloudflared.exe"
) do (
  if not defined CLOUDFLARED (
    if exist %%p set "CLOUDFLARED=%%~p"
  )
)
if not defined CLOUDFLARED (
  echo cloudflared not found 1>&2
  exit /b 1
)

REM Drop the previous log so a stale URL cannot be read as the new one.
del .runtime\tunnel.log .runtime\tunnel.err >nul 2>&1

"%CLOUDFLARED%" tunnel --url http://localhost:5000 --no-autoupdate >> .runtime\tunnel.log 2>> .runtime\tunnel.err
