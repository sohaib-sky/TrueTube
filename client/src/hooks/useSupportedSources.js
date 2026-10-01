import { useEffect, useState } from 'react';
import { getSupportedSources } from '../services/api.js';

/**
 * The supported-source list is needed by two independent components, so the
 * request is shared through a module-level cache. It is a real API call — if
 * the backend is unreachable the components show an honest fallback.
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
    cached ? { status: 'ready', data: cached } : { status: 'loading', data: null },
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    load(controller.signal)
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch((error) => {
        if (active && error?.name !== 'AbortError') setState({ status: 'error', data: null });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

export default useSupportedSources;
