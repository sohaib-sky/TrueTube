# syntax=docker/dockerfile:1

# TrueTube — production image.
#
# Two stages, because the runtime does not need the 250 MB of build tooling that
# produced the frontend. The final image carries only Node, FFmpeg, yt-dlp and
# the built application.
#
# The tools are downloaded here rather than committed to the repository. FFmpeg
# alone is ~80 MB on Linux; keeping it in git would make every clone pay for a
# binary most contributors never run.

# ---------------------------------------------------------------- build ------
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Dependencies first, so a source-only change reuses the cached install layer.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY client ./client
COPY server ./server

# The built frontend, which the API serves in production. The build script also
# regenerates the sitemap from the server's route table first, so the image can
# never ship a sitemap that disagrees with the routes it actually serves.
RUN npm run build

# The server as a single file, with its runtime dependencies inlined. The
# createRequire shim is required: express and its dependencies call `require()`
# internally, which esbuild's ESM output cannot otherwise satisfy.
#
# The installed binary is used rather than `npx esbuild` so nothing has to
# resolve the package at build time.
RUN node_modules/.bin/esbuild server/src/server.js \
      --bundle --platform=node --format=esm --target=node20 \
      --outfile=dist/server/src/app.mjs \
      --banner:js="import{createRequire as __ttCreateRequire}from'node:module';const require=__ttCreateRequire(import.meta.url);" \
      --log-level=warning

# -------------------------------------------------------------- runtime ------
FROM node:22-bookworm-slim AS runtime

# ffmpeg merges the separate audio and video streams, and remuxes them into a
# container players accept. Without it, most YouTube downloads produce a file
# with no audio or one the browser refuses to play.
# ffprobe comes from the same package and yt-dlp uses it to verify output.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# The yt-dlp standalone build. `--flat` picks up the latest release rather than
# pinning one, which is deliberate: extractors break often, and a stale yt-dlp is
# the single most common reason a working site stops working. Rebuilding the
# image is how you pick up a fix.
RUN curl -fsSL -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && yt-dlp --version

WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    DOWNLOAD_DIR=/tmp/truetube

# The layout mirrors the local project so the same relative path lookups work in
# both places: config.js walks two directories up from its own location to find
# the project root, then reads `server/public` and `.tools` from there.
COPY --from=build /app/dist/server/src/app.mjs ./server/src/app.mjs
COPY --from=build /app/server/public ./server/public

# Downloads are scratch space. Keeping them out of the image means a fresh deploy
# starts clean and the layer stays small.
#
# The chown is load-bearing. This line runs as root, so without it the directory
# is root-owned while the server below runs as `node` — which then cannot create
# a job directory inside it. Every single download would fail with EACCES, and
# the health check would still report everything as healthy.
RUN mkdir -p /tmp/truetube && chown node:node /tmp/truetube

# Downloads are user-supplied links producing user-supplied files, so the server
# runs unprivileged. A public file server should not be root.
USER node

EXPOSE 5000

# Render's free tier idles out after 15 minutes and only wakes on an incoming
# request, so the health check must be the cheap path — it is a static reply and
# does not touch the disk.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/app.mjs", "--production"]
