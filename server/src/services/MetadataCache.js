/**
 * TTL + LRU cache for extracted metadata.
 *
 * Used to re-validate the format a client selected before a download starts,
 * so yt-dlp only ever receives format identifiers that genuinely exist for
 * that URL.
 */
class MetadataCache {
  #entries = new Map();

  #evict() {
    const now = Date.now();
    for (const [key, entry] of this.#entries) {
      if (now - entry.storedAt > this.ttlMs) this.#entries.delete(key);
    }
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next();
      if (oldest.done) break;
      this.#entries.delete(oldest.value);
    }
  }

  constructor({ ttlMs, maxEntries }) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > this.ttlMs) {
      this.#entries.delete(key);
      return null;
    }
    // refresh recency
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.#entries.delete(key);
    this.#entries.set(key, { value, storedAt: Date.now() });
    this.#evict();
  }
}

export default MetadataCache;
