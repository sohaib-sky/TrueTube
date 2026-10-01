@echo off
setlocal enabledelayedexpansion
title TrueTube - Push to GitHub

rem The remote and the commit are already in place, so this only performs the
rem push. It has to run in a real console: git opens a browser for the GitHub
sign-in, and that prompt cannot appear in a background or non-interactive shell.

cd /d "%~dp0\.."

echo.
echo   Publish TrueTube to GitHub
echo   ============================
echo.
echo   Repository: https://github.com/sohaib4946/truetube
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo   [X] Git is not on PATH. Restart Windows, or reopen this window.
  echo.
  pause
  exit /b 1
)

git log --oneline -1
echo.
echo   Pushing to branch 'main'. A browser window will open asking you to sign
echo   in to GitHub. Press "Authorize" there - this is the only step that needs
echo   you.
echo.

rem 'main' rather than 'master': it is the branch the repository already had, and
rem the one Render treats as the default. Pushing to a second branch would leave
rem Render deploying a repository that still looks empty.
git push -u origin main

if errorlevel 1 (
  echo.
  echo   [X] The push failed. The message above says why. Common ones:
  echo.
  echo     - the sign-in was cancelled or timed out
  echo     - the repository name is misspelled, or it is under a different
  echo       account than the one you signed in with
  echo.
  pause
  exit /b 1
)

echo.
echo   ============================================
echo    Pushed. TrueTube is on GitHub.
echo   ============================================
echo.
echo   Now go to https://dashboard.render.com
echo.
echo     1. Sign up with your GitHub account
echo     2. New  >  Blueprint
echo     3. Choose this repository
echo     4. Apply  - render.yaml sets everything else up
echo.
echo   The first build takes a few minutes: it installs FFmpeg and
echo   downloads yt-dlp, so the image is not instant.
echo.
pause
exit /b 0
