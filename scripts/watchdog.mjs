// Keeps TrueTube's public address up.
//
// Every tunnel tried here has failed in a different way: Cloudflare's quick
// tunnel endpoint timed out from this connection, serveo dropped a long streamed
// download after a few seconds, and localtunnel's own server answered 503. So
// the address dies, and nobody notices until someone opens a dead link.
//
// This watches the public address and restarts the tunnel when it goes. The
// subdomain is pinned in run-lt.bat, so a restart comes back on the same
// address instead of a new random one.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5000;
const CHECK_EVERY = 45_000;
const RESTART_BACKOFF = 25_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const reachable = async (url, ms) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return r.ok;
  } catch {
    return false;
  }
};

/**
 * The address to watch is whatever localtunnel last handed out, read from its
 * own log. It used to be hardcoded to a pinned subdomain, and when the pin was
 * dropped the watcher kept probing the old name while the tunnel served a new
 * random one — so it reported "down" forever and restarted a healthy tunnel.
 */
function currentTunnel() {
  try {
    const log = readFileSync(join(ROOT, '.runtime', 'lt.log'), 'utf8');
    return /https:\/\/[a-z0-9-]+\.loca\.lt/.exec(log)?.[0] ?? null;
  } catch {
    return null;
  }
}

function startTunnel() {
  spawn('cmd', ['/c', join(ROOT, 'scripts', 'run-lt.bat')], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

const local = () => reachable(`http://127.0.0.1:${PORT}/api/health`, 8000);

let restarts = 0;
console.log('watching the tunnel localtunnel last announced (check every 45s)');

for (;;) {
  const serverUp = await local();
  const tunnel = currentTunnel();
  const tunnelUp = tunnel ? await reachable(`${tunnel}/api/health`, 15_000) : false;

  if (!serverUp) console.log('server down - not restarting it; the launcher owns that');

  if (!tunnel) {
    console.log('no address in the tunnel log yet');
  } else if (!tunnelUp) {
    restarts += 1;
    console.log(`${tunnel} down, restart #${restarts}`);
    startTunnel();
    await sleep(RESTART_BACKOFF);
    const next = currentTunnel();
    console.log(
      next && (await reachable(`${next}/api/health`, 15_000))
        ? `back up at ${next}`
        : 'still down, will retry next cycle',
    );
  } else if (restarts) {
    console.log('stable again');
    restarts = 0;
  }

  await sleep(CHECK_EVERY);
}
