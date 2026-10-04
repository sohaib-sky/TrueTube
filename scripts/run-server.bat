@echo off
REM ============================================================
REM  TrueTube - starts only the API server.
REM  A wrapper script exists because the Node install path
REM  contains a space, and quoting that inside a
REM  `cmd /c "..."` launch line breaks cmd's own quote parsing.
REM  It also keeps TRUST_PROXY in one place: this server is
REM  reached through the tunnel, so the proxy hop is trusted.
REM ============================================================
cd /d "%~dp0.."
set "TRUST_PROXY=true"
REM Absolute path: Task Scheduler does not inherit the interactive PATH, so a
REM bare `node` fails there with "not recognized".
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" (
  echo node not found at %NODE% 1>&2
  exit /b 1
)
del .runtime\server.log .runtime\server.err >nul 2>&1
"%NODE%" server\src\server.js --production >> .runtime\server.log 2>> .runtime\server.err
