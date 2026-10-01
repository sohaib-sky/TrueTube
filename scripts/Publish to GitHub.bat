@echo off
setlocal enabledelayedexpansion
title TrueTube - Publish to GitHub

cd /d "%~dp0\.."

echo.
echo   Publish TrueTube to GitHub
echo   ============================
echo.
echo   Paste your repository URL, for example:
echo     https://github.com/yourname/truetube.git
echo.
set /p "REPO=Paste your repo URL: "

if "%REPO%"=="" (
  echo.
  echo   [X] No URL given. Nothing was changed.
  echo.
  pause
  exit /b 1
)

rem Catch the placeholder that would otherwise be pushed as a literal URL and
rem fail much later with a confusing authentication error.
echo %REPO% | findstr /I "AAPKA-USERNAME" >nul
if not errorlevel 1 (
  echo.
  echo   [X] That is still the placeholder from the instructions.
  echo       Replace AAPKA-USERNAME with your real GitHub username.
  echo.
  pause
  exit /b 1
)

echo.
echo   Checking the URL...
rem The host must answer before anything is changed locally.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Method Head '%REPO%'; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { exit 0 } } catch { }; exit 1" >nul 2>&1
if errorlevel 1 (
  echo   [X] %REPO% did not answer.
  echo       Check the spelling, and that the repository exists and is not private
  echo       to strangers. A brand-new empty repository is fine.
  echo.
  pause
  exit /b 1
)
echo   URL is reachable.

echo.
echo   Setting the remote...
git remote remove origin >nul 2>&1
git remote add origin "%REPO%"
if errorlevel 1 (
  echo   [X] Could not set the remote.
  pause
  exit /b 1
)

echo.
echo   Pushing. Git may ask you to sign in to GitHub - a browser window will
echo   open. That is expected and it is the only step that needs you.
echo.
git push -u origin master
if errorlevel 1 (
  echo.
  echo   [X] The push failed. Read the message above - it is usually one of:
  echo       - you did not finish signing in
  echo       - the repository already has commits (then run:  git pull --rebase origin master)
  echo       - the repository name does not match the URL
  echo.
  pause
  exit /b 1
)

echo.
echo   ============================================
echo    Pushed. TrueTube is on GitHub.
echo   ============================================
echo.
echo   Next: go to dashboard.render.com
echo     1. Sign up with your GitHub account
echo     2. New ^> Blueprint
echo     3. Pick this repository
echo     4. Apply - render.yaml sets everything up
echo.
pause
exit /b 0
