import MetadataCache from './MetadataCache.js';
import config from '../config.js';

/**
 * Process-local cache of extracted metadata, keyed by a hash of the normalised
 * URL. Used to verify that a client-selected format really exists before a
 * download is allowed to start.
 */
export const metadataCache = new MetadataCache(config.metadataCache);

/**
 * @param {string} key
 * @returns {{ id: string, title: string, formats: Array<{id: string, kind: string, ext: string}> } | null}
 */
export function getCachedMetadata(key) {
  return metadataCache.get(key);
}

export function setCachedMetadata(key, value) {
  metadataCache.set(key, value);
}
