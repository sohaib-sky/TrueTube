/**
 * A tiny counting semaphore.
 *
 * Downloads are heavy: one transfer can saturate a CPU and saturate the disk.
 * With only per-endpoint rate limiting, a handful of simultaneous requests is
 * enough to make every other request — including a one-second `--version`
 * probe — time out, which is what makes a server feel intermittently broken.
 * Capping how many run at once keeps the service responsive and makes queueing
 * visible instead of silent.
 */
export function createLimiter(concurrency) {
  let active = 0;
  /** @type {Array<() => void>} */
  const queue = [];

  const releaseSlot = () => {
    if (active > 0) active -= 1;
    const next = queue.shift();
    if (next) next();
  };

  return {
    /** @returns {number} how many are running right now */
    get active() {
      return active;
    },

    /** @returns {number} how many are waiting */
    get queued() {
      return queue.length;
    },

    /**
     * Take a slot, resolving to the function that gives it back.
     *
     * The caller owns the release and must call it in a `finally`. Wrapping the
     * whole job in a callback looks tidier but couples the slot's lifetime to
     * the job's, which is exactly the coupling that deadlocks a queue.
     *
     * @returns {Promise<() => void>}
     */
    acquire() {
      return new Promise((resolve) => {
        const start = () => {
          active += 1;
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            releaseSlot();
          });
        };

        if (active < concurrency) start();
        else queue.push(start);
      });
    },

    /**
     * Run `task` while holding a slot.
     *
     * @template T
     * @param {() => Promise<T>} task
     * @returns {Promise<T>}
     */
    async run(task) {
      const release = await this.acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

export default createLimiter;
