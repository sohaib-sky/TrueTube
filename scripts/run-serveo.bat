@echo off
REM ============================================================
REM  TrueTube - public tunnel via serveo (SSH reverse tunnel).
REM  Used as a fallback when the Cloudflare quick tunnel cannot
REM  reach api.trycloudflare.com; that endpoint times out on slow
REM  or heavily throttled connections even though it is up.
REM
REM  Wrapper because the SSH path is separate from the repo and
REM  the URL has to be written somewhere the app can read.
REM ============================================================
cd /d "%~dp0.."
del .runtime\serveo.log >nul 2>&1
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 ^
    -R 80:localhost:5000 serveo.net > .runtime\serveo.log 2>&1
