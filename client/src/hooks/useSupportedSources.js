import { useEffect, useState } from 'react';
import { getSupportedSources } from '../services/api.js';
// Generated at build time from the server's own allowlist (see
// scripts/build-supported-fallback.mjs). Used only when the live request fails.
import fallback from '../data/supportedFallback.json';

/**
 * The supported-source list is needed by two independent components, so the
 * request is shared through a module-level cache. It is a real API call, and
 * its result always wins. When it cannot be made — no backend, a network
 * failure — the build-time copy is used instead, so the page still renders a
 * real list rather than a grid of empty tiles.
 *
 * `source` records which of the two happened, because a list read from the
 * bundled copy cannot claim to be live.
 */
let inFlight = null;
let cached = null;

function load(signal) {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = getSupportedSources()
      .then((data) => {
        cached = data;
        return data;
      })
      .catch((error) => {
        inFlight = null;
        throw error;
      });
  }
  return inFlight;
}

export function useSupportedSources() {
  const [state, setState] = useState(() =>
    cached
      ? { status: 'ready', source: 'live', data: cached }
      : { status: 'loading', source: 'live', data: null },
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    load(controller.signal)
      .then((data) => {
        if (active) setState({ status: 'ready', source: 'live', data });
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return;
        setState({ status: 'ready', source: 'bundled', data: fallback });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

export default useSupportedSources;
