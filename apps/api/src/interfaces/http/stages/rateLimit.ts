import { TooManyRequestsError } from '../errors.ts';
import type { Req, Stage } from '../types.ts';

interface Window {
  count: number;
  resetAt: number;
}

const MAX_KEYS = 10_000;

/**
 * Fixed-window, in-memory limiter. Fine for one instance; with several
 * instances behind a balancer it needs a shared store (Postgres/Redis).
 */
export const rateLimit = ({
  windowMs,
  max,
  key = (req) => req.socket.remoteAddress ?? 'unknown',
  now = Date.now,
}: {
  windowMs: number;
  max: number;
  key?: (req: Req) => string;
  now?: () => number;
}): Stage<object> => {
  const windows = new Map<string, Window>();

  const prune = (t: number) => {
    for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
  };

  return (req) => {
    const t = now();
    const k = key(req);
    let w = windows.get(k);
    if (!w || w.resetAt <= t) {
      if (windows.size >= MAX_KEYS) prune(t);
      w = { count: 0, resetAt: t + windowMs };
      windows.set(k, w);
    }
    w.count += 1;
    if (w.count > max) throw new TooManyRequestsError();
  };
};
