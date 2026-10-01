# Builds a self-contained TrueTube folder.
#
# The goal is a directory someone can copy anywhere and start by double-clicking
# one file — no npm install, no PATH edits, no commands.
#
# Three things make that possible:
#
#   1. The server is bundled to a single ESM file with its seven runtime
#      dependencies inlined, so the 245 MB of node_modules (which is almost
#      entirely client build tooling that is not needed at runtime) is not
#      shipped. Only Node itself has to exist.
#
#   2. The bundle is written to `server/src/app.mjs` rather than some flatter
#      path, because config.js derives the project root by going two directories
#      up from its own location. Writing the bundle anywhere else would silently
#      repoint the client build, the tools folder and the download directory.
#
#      The output stays ESM, and the `createRequire` banner is what makes that
#      work: express, body-parser and depd all call `require()` internally, and
#      esbuild's ESM output has no `require` to give them, so it throws "Dynamic
#      require of path is not supported" on startup. The banner supplies a real
#      one built from the bundle's own URL. Switching to `--format=cjs` instead
#      would fix the require but break `import.meta.url` in config.js, which is
#      how the server locates its project root.
#
#   3. Only yt-dlp and ffmpeg are copied. ffprobe is never invoked by the server
#      — it is a test-only tool — so shipping it would add 158 MB for nothing.

$ErrorActionPreference = 'Stop'

$root       = Split-Path -Parent $PSScriptRoot
$outDir     = Join-Path $root 'TrueTube'
$serverOut  = Join-Path $outDir 'server\src\app.mjs'
$esbuild    = Join-Path $root 'node_modules\@esbuild\win32-x64\esbuild.exe'

Write-Host ''
Write-Host '  TrueTube - portable build' -ForegroundColor Cyan
Write-Host '  ==========================' -ForegroundColor Cyan

if (-not (Test-Path $esbuild)) { throw "esbuild not found at $esbuild" }

# --- 1. Client -----------------------------------------------------------------
$publicDir = Join-Path $root 'server\public'
if (-not (Test-Path (Join-Path $publicDir 'index.html'))) {
  throw 'No client build found. Run `npm run build` first.'
}
Write-Host '  [1/4] copying the built client...' -NoNewline
$publicOut = Join-Path $outDir 'server\public'
if (Test-Path $publicOut) { Remove-Item $publicOut -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $publicOut) | Out-Null
Copy-Item $publicDir $publicOut -Recurse
Write-Host ' done'

# --- 2. Bundle the server ------------------------------------------------------
Write-Host '  [2/4] bundling the server (no node_modules needed)...' -NoNewline
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $serverOut) | Out-Null
$requireShim = "import{createRequire as __ttCreateRequire}from'node:module';const require=__ttCreateRequire(import.meta.url);"

& $esbuild (Join-Path $root 'server\src\server.js') `
  --bundle `
  --platform=node `
  --format=esm `
  --target=node20 `
  --outfile=$serverOut `
  --banner:js=$requireShim `
  --log-level=warning
if ($LASTEXITCODE -ne 0) { throw "esbuild failed with exit code $LASTEXITCODE" }
Write-Host ' done'

# --- 3. Tools ------------------------------------------------------------------
$toolsOut = Join-Path $outDir '.tools'
New-Item -ItemType Directory -Force -Path $toolsOut | Out-Null
Write-Host '  [3/4] copying tools...' -NoNewline
foreach ($tool in @('yt-dlp.exe', 'ffmpeg.exe')) {
  $src = Join-Path $root ".tools\$tool"
  if (-not (Test-Path $src)) { throw "Missing required tool: $src" }
  Copy-Item $src (Join-Path $toolsOut $tool) -Force
}
Write-Host ' done'

# --- 4. Config and docs --------------------------------------------------------
Write-Host '  [4/4] writing config and launcher...' -NoNewline
Copy-Item (Join-Path $root '.env') (Join-Path $outDir '.env') -Force
Copy-Item (Join-Path $root 'scripts\Start TrueTube.bat') (Join-Path $outDir 'Start TrueTube.bat') -Force
Copy-Item (Join-Path $root 'scripts\README-portable.txt') (Join-Path $outDir 'README.txt') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $outDir 'logs') | Out-Null
Write-Host ' done'

# --- 5. Clear anything a previous run of the app left behind ------------------
# The download directory is created inside the output folder at runtime, so
# building into an existing folder silently shipped whatever the last run
# abandoned. One build came out 45 MB heavier than the application.
#
# But it is only safe to delete when nothing is running. A previous build cleared
# 666 MB that turned out to be somebody's downloads in progress — the folder is
# full of live transfers if the app is up, and they are not this script's to
# throw away. So the port is checked first, and the build refuses rather than
# guessing.
#
# This runs before the size is reported. Measuring first made the build announce
# 224 MB for a folder that was actually 179 MB, which is exactly the kind of
# number a user would believe.
$port = (Select-String -Path (Join-Path $root '.env') -Pattern '^PORT=(\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
if (-not $port) { $port = '5000' }
$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

$downloads = Join-Path $outDir 'server\downloads'
if (Test-Path $downloads) {
  $stale = (Get-ChildItem $downloads -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum)
  if ($busy) {
    Write-Host ''
    Write-Host "  [5/5] SKIPPED: TrueTube is running on port $port." -ForegroundColor Yellow
    # Formatted into the string first: passing -f alongside -ForegroundColor makes
    # PowerShell try to bind the format operator as a second parameter of the
    # same cmdlet.
    $mb = [math]::Round($stale.Sum / 1MB, 1)
    Write-Host "        Left $mb MB of downloads alone - close the app first." -ForegroundColor Yellow
    Write-Host '        The build finished, but the folder still holds live job data.' -ForegroundColor Yellow
  } else {
    Remove-Item $downloads -Recurse -Force
    if ($stale.Sum -gt 0) {
      Write-Host ("  [5/5] cleared {0:N1} MB of stale downloads" -f ($stale.Sum / 1MB)) -ForegroundColor Yellow
    }
  }
}

Write-Host ''
Write-Host "  Built: $outDir" -ForegroundColor Green
# Measured here, after the cleanup, so the number describes the folder that
# actually exists rather than the one before it was tidied.
$sizeMb = [math]::Round(((Get-ChildItem $outDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "  Size : $sizeMb MB"
Write-Host ''
Write-Host '  Open the folder and double-click "Start TrueTube.bat".' -ForegroundColor Yellow
Write-Host ''
