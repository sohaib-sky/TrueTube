# TrueTube

**A modern, self-hosted media utility.** Paste a supported video URL, read the real metadata and format list
returned by the source, and download the exact option you choose.

TrueTube is built to be *honest*: it never fabricates a title, a thumbnail, a format list or a progress bar. If the
download engine cannot do something, the interface shows a real error instead of a simulation.

> Download only content you have permission to download and that the relevant platform allows you to download.
> TrueTube does not bypass DRM, paywalls, private content or any other access control.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Installing yt-dlp](#installing-yt-dlp)
- [Installing FFmpeg](#installing-ffmpeg)
- [Environment variables](#environment-variables)
- [Development](#development)
- [Production](#production)
- [API reference](#api-reference)
- [Security](#security)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Legal and usage responsibility](#legal-and-usage-responsibility)

---

## Features

- **Real URL analysis** — `yt-dlp` runs on the server; the client only renders what the API returns.
- **Real format information** — resolutions, codecs, sizes and audio bitrates exactly as reported by the source.
- **Real downloads** — the server produces a file with `yt-dlp`, streams it back, then deletes it.
- **Honest progress** — the progress bar reflects bytes actually received over the network. There is no fake
  percentage and no `setTimeout` pretending to work.
- **Private content refused by design** — no cookies, no credentials, no netrc. Private, members-only, sign-in-gated,
  age-restricted and DRM-protected media return explicit errors.
- **Dependency detection** — missing `yt-dlp` or FFmpeg is reported clearly through `/api/health` and as a typed
  `503` error, never silently ignored.
- **Premium glassmorphism UI** — dark, restrained, responsive from 320px upwards, keyboard accessible and
  `prefers-reduced-motion` aware.
- **Rate limiting, SSRF protection and safe process execution** on every request.

## Architecture

```
Browser (React + Vite)
        │  POST /api/analyze          (URL)
        │  POST /api/download         (URL + verified format id)
        ▼
TrueTube API (Express)
        │  helmet · cors · rate limits · body limits
        ▼
Validation layer
        │  URL shape · hostname allowlist · public-IP DNS check · format re-verification
        ▼
Service layer
        │  execFile(yt-dlp, args[])  — no shell, argument array only, hard timeouts
        │  isolated temp directory per job
        ▼
File streamed to the client → temp directory removed
```

The frontend never executes `yt-dlp`. The backend re-validates everything the client sends.

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 18.17 (tested on 24.x) | ESM project, `"type": "module"` |
| npm | ≥ 9 | ships with Node |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | recent release | **the official build, from the yt-dlp/yt-dlp repo** — required for analysis and downloads |
| FFmpeg | recent release | required to merge separate video + audio streams |

FFmpeg is optional but effectively necessary for YouTube: most current videos only expose video-only and
audio-only streams, which must be merged. Without FFmpeg, TrueTube still works, but only for sources that
provide combined formats and for audio-only downloads. This is surfaced in the UI and in `/api/health`.

## Engine

TrueTube uses **upstream yt-dlp unmodified** — the official project at
**<https://github.com/yt-dlp/yt-dlp>**, with no fork, patch or wrapper:

- the binary is installed by you (release download, `pipx`, or `pip`) and simply placed on `PATH` or pointed at
  with `YTDLP_PATH`;
- the server executes it with `execFile` and an argument array — never through a shell;
- the extra flags TrueTube always passes are only hardening/formatting options (`--no-playlist`,
  `--ignore-config`, `--no-cookies`, `--no-cookies-from-browser`, `--no-cache-dir`, `--restrict-filenames`);
- the exact version in use is reported by `GET /api/health` under `capabilities.ytDlp.version`, so you can confirm
  which build is running;
- to update: re-download the release, or run `yt-dlp -U` (pip/pipx installs).

The browser never runs yt-dlp — only this server does.

## Installation

```bash
git clone <your-fork> truetube
cd truetube
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev               # API on :5000, Vite dev server on :5173
```

### Installing yt-dlp

**Windows (PowerShell)**

```powershell
New-Item -ItemType Directory -Force .tools | Out-Null
Invoke-WebRequest -Uri https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -OutFile .tools\yt-dlp.exe
# then set YTDLP_PATH=C:\path\to\truetube\.tools\yt-dlp.exe in .env
```

**macOS (Homebrew)**

```bash
brew install yt-dlp
```

**Linux (pipx or the standalone binary)**

```bash
pipx install yt-dlp          # or download yt-dlp_linux from the releases page
```

**Python (any platform)**

```bash
python -m pip install -U yt-dlp
```

If the binary is on your `PATH`, no configuration is needed. Otherwise set `YTDLP_PATH` to the absolute path of
the executable. The service probes the binary at startup and re-checks it every 60 seconds.

### Installing FFmpeg

- **Windows**: download a build from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) or
  [BtbN](https://github.com/BtbN/FFmpeg-Builds), then either add it to `PATH` or set `FFMPEG_PATH`.
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` or your distribution's equivalent.

Place third-party binaries in `.tools/` — the directory is git-ignored, so nothing gets committed by accident.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API port (also serves the built frontend in production) |
| `CLIENT_URL` | `http://localhost:5173` | Origin allowed by CORS |
| `NODE_ENV` | `development` | `production` enables JSON logging and stricter caching |
| `DOWNLOAD_DIR` | `./server/downloads` | Where temporary job directories are created |
| `YTDLP_PATH` | *(empty)* | Absolute path to the `yt-dlp` executable |
| `FFMPEG_PATH` | *(empty)* | Absolute path to the `ffmpeg` executable |
| `YTDLP_ANALYZE_TIMEOUT_MS` | `45000` | Hard timeout for metadata extraction |
| `YTDLP_DOWNLOAD_TIMEOUT_MS` | `1200000` | Hard timeout for a download (20 min — raise it for very large files) |
| `YTDLP_MAX_BUFFER` | `52428800` | Max captured child-process output |
| `TEMP_FILE_MAX_AGE_MINUTES` | `30` | Age at which abandoned job directories are swept |
| `TRUST_PROXY` | `false` | Set to `true` **only** behind a proxy you control |
| `LOG_LEVEL` | `info` | `debug` · `info` · `warn` · `error` · `silent` |
| `METADATA_CACHE_TTL_MS` | `300000` | How long extracted metadata is cached for format re-verification |

`.env` is git-ignored. Never commit secrets.

## Development

```bash
npm run dev         # API + Vite dev server together
npm run server      # API only (watch mode is `npm run dev:server`)
npm run client      # Vite dev server only
```

The Vite dev server proxies `/api` to `http://127.0.0.1:$PORT`, so the frontend always talks to the real API.

## Production

```bash
npm run build       # builds the client into server/public
npm start           # NODE_ENV=production, serves API + client on PORT
```

In production the Express server serves the hashed assets from `server/public` with long-lived cache headers,
plus an SPA fallback so `/privacy` and `/terms` resolve through the client router. API responses are always
`no-store`. Stack traces and internal reasons are never included in production error payloads.

## API reference

All responses use the envelope `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "code": "...", "message": "..." } }`.

### `GET /api/health`

Real service state, including whether the binaries are actually usable. Returns `200` when `yt-dlp` is available
and `503` with `"status": "degraded"` when it is not.

### `GET /api/supported`

The live hostname allowlist, plus engine and merge capability flags. The Supported Platforms section renders this
response, so the page can never advertise a source the backend would reject.

### `POST /api/validate`

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

Shape and allowlist validation only — no `yt-dlp` invocation.

### `POST /api/analyze`

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

Runs `yt-dlp --dump-json` and returns the normalised metadata: `id`, `title`, `uploader`, `duration`,
`durationText`, `thumbnail`, `extractor`, `platform`, `formats[]`, `videoFormats[]`, `audioFormats[]` and the
server's `capabilities`. Each format carries `id`, `kind` (`muxed` · `video` · `audio`), `ext`, `label`, `height`,
`fps`, `vcodec`, `acodec`, `filesize`, `filesizeText` and `requiresFfmpeg`. Adaptive HLS/DASH manifests are
omitted because they are not files.

### `GET /api/formats?url=...`

Same analysis, returning only the format list. Shares the analyze rate limit.

### `POST /api/download`

```json
{ "url": "https://www.youtube.com/watch?v=...", "formatId": "137", "kind": "video" }
```

- `formatId` must be `best` or a format id that really exists for that URL. It is re-verified against cached (or
  freshly extracted) metadata before any process is started, and only then turned into a `yt-dlp` selector.
- `kind` is only a hint; the server uses the value from real metadata.
- Video-only selections are merged with the best audio track and require FFmpeg.
- Success: `200` with the file as `Content-Disposition: attachment`, a real `Content-Length`, and a sanitised
  filename. The client streams the response and shows genuine byte progress.
- The temporary job directory is deleted on success, failure, timeout and client disconnect.

### Error codes

`INVALID_URL` · `BLOCKED_HOST` · `HOST_UNRESOLVED` · `UNSUPPORTED_URL` · `PRIVATE_CONTENT` · `MEMBERS_ONLY` ·
`AUTH_REQUIRED` · `AGE_RESTRICTED` · `DRM_PROTECTED` · `GEO_BLOCKED` · `VIDEO_UNAVAILABLE` · `ACCESS_DENIED` ·
`EXTRACTION_FAILED` · `NO_FORMATS_AVAILABLE` · `FORMAT_UNAVAILABLE` · `INVALID_FORMAT` · `FFMPEG_UNAVAILABLE` ·
`YTDLP_UNAVAILABLE` · `DOWNLOAD_EMPTY` · `TIMEOUT` · `UPSTREAM_TIMEOUT` · `UPSTREAM_NETWORK` ·
`PROCESSING_FAILED` · `RATE_LIMITED` · `VALIDATION_ERROR` · `PAYLOAD_TOO_LARGE` · `INTERNAL_ERROR`

### Rate limits

| Endpoint | Window | Limit |
| --- | --- | --- |
| `POST /api/analyze`, `GET /api/formats` | 10 min | 25 |
| `POST /api/download` | 10 min | 10 |
| other `/api/*` | 15 min | 300 |
| `GET /api/health` | 1 min | 60 |

Exceeding a limit returns `429` with code `RATE_LIMITED` and a `Retry-After` header.

## Security

- **No shell execution.** `yt-dlp` is started with `execFile` and an argument array — user input is never
  concatenated into a command string.
- **Locked-down `yt-dlp` flags.** `--no-playlist`, `--ignore-config`, `--no-cache-dir`, `--no-cookies`,
  `--no-cookies-from-browser`, `--restrict-filenames`, plus hard timeouts. No credential option is ever accepted
  from the client.
- **SSRF protection.** Only allowlisted public hostnames are accepted; IP literals, loopback, `.local`/`.internal`
  suffixes and hostnames that resolve to private, link-local or cloud-metadata ranges are rejected.
- **Safe filenames.** Output templates use the media id only (`%(id)s.%(ext)s`), so a hostile title can never
  influence a path. Download filenames are sanitised and length-capped.
- **Format verification.** A client cannot invent a format id: it must exist in the real metadata.
- **HTTP hardening.** Helmet with a strict CSP, explicit CORS allowlist, `8kb` JSON body limit, no `x-powered-by`,
  `no-store` on API responses, graceful shutdown and request logging.
- **Isolation & cleanup.** One random directory per job, deleted on every exit path, plus a background sweeper for
  anything left behind by a killed process.
- **Rate limiting** per client address on analysis and downloads.

Run behind your own reverse proxy with TLS if you expose the service publicly, and set `TRUST_PROXY=true` only when
that proxy is under your control.

## Project structure

```
truetube/
├── client/
│   ├── public/               favicon, robots.txt, sitemap.xml, manifest, OG image
│   └── src/
│       ├── animations/       shared Framer Motion variants
│       ├── components/       Header, Footer, UrlAnalyzer, ResultCard, FormatSelector, …
│       ├── hooks/            useUrlAnalyzer, useSeo, useScrolled, usePrefersReducedMotion, …
│       ├── pages/            Home, Privacy, Terms, 404
│       ├── sections/         Hero, HowItWorks, Features, Platforms, FAQ, CTA
│       ├── services/         api.js — the only place that talks to the backend
│       ├── styles/           design tokens, base, glass system, components
│       ├── utils/            validation, formatting, error catalogue, format grouping
│       ├── App.jsx           router shell + page transitions
│       └── main.jsx
├── server/
│   ├── src/
│   │   ├── controllers/      analyze, download, health
│   │   ├── middleware/       rate limits, error envelope
│   │   ├── routes/           /api router
│   │   ├── services/         ytdlp, mediaService, dependencyDetector, tempFiles, cache
│   │   ├── utils/            config, logger, urlValidator, network, AppError
│   │   ├── app.js            express app + static serving
│   │   └── server.js         entry point, graceful shutdown
│   ├── downloads/            temporary job directories (runtime only)
│   └── public/               built frontend (generated by `npm run build`)
├── .env.example
└── package.json
```

## Troubleshooting

**`YTDLP_UNAVAILABLE` (503)**
The binary is missing or not executable. Check `YTDLP_PATH`, or add `yt-dlp` to `PATH`, then restart the server.
`GET /api/health` reports the exact reason.

**`FFMPEG_UNAVAILABLE` (503)**
The selected format needs the best video and audio streams merged. Install FFmpeg or pick a combined format. The
Supported Platforms section tells you when the server is in this state.

**`Unsupported URL`**
The hostname is not on the allowlist, or the installed `yt-dlp` has no extractor for that link. Support changes
with the `yt-dlp` version — update it and retry.

**`Private content` / `Sign-in required` / `Members-only`**
By design. TrueTube never sends cookies or credentials, so gated media is refused.

**`RATE_LIMITED` (429)**
Wait for the window to reset. The UI surfaces the wait as a friendly message.

**`HOST_UNRESOLVED`**
DNS could not resolve the hostname from the server. Check the link and the server's DNS.

**`UPSTREAM_BLOCKED` / `AUTH_REQUIRED` on every link**
The platform is blocking this server's IP address. Shared, VPN and datacenter IPs are rate-limited by YouTube,
Vimeo and others ("Sign in to confirm you're not a bot"). TrueTube never works around this with credentials — run
the service from a residential connection, or expect intermittent failures.

**Port already in use**
Change `PORT` in `.env` (the Vite dev proxy reads the same variable).

**Frontend build not found (503 on `/`)**
Run `npm run build`, or use `npm run dev` for development.

**Windows: file is locked during cleanup**
Job directories are removed with retries because Windows keeps handles open briefly. The sweeper retries again if a
removal still fails.

## Legal and usage responsibility

TrueTube is a general-purpose utility. Its operator is responsible for how the deployment is used. You are
responsible for the content you request. Only download material you own, are licensed to use, or that the source
platform explicitly permits you to download. Respect copyright law and the terms of the platforms involved. TrueTube
is not affiliated with any platform whose media it processes.
