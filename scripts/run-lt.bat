@echo off
REM ============================================================
REM  TrueTube - public tunnel via localtunnel (no account).
REM  Third fallback: Cloudflare quick tunnels have started
REM  timing out from this connection, and serveo drops a long
REM  streamed download response after a few seconds.
REM  The tunnel password localtunnel asks for is this machine's
REM  public IP, so visitors get an interstitial page; that is a
REM  limitation of the service, not of this application.
REM ============================================================
cd /d "%~dp0.."
del .runtime\lt.log .runtime\lt.err >nul 2>&1
npx --yes localtunnel --port 5000 --local-host 127.0.0.1 > .runtime\lt.log 2>> .runtime\lt.err

