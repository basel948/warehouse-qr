// Small in-memory rate limiter for the public order endpoint and admin login.
// Kept in process memory (no Redis): the site runs as a single Railway
// instance, so this is enough to stop a script hammering an endpoint. Counts
// reset on redeploy, which is fine for this purpose.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  // Drop expired entries now and then so the map can't grow without bound.
  if (buckets.size < 1000) return;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

/** Seconds until `key` may be used again, or 0 if it's currently under `limit`. */
export function retryAfterSeconds(key: string, limit: number): number {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || bucket.resetAt <= now || bucket.count < limit) return 0;
  return Math.ceil((bucket.resetAt - now) / 1000);
}

/** Records one use of `key` in a fixed window of `windowMs`. */
export function recordHit(key: string, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count++;
  }
}

export function clearHits(key: string) {
  buckets.delete(key);
}

/**
 * Best-effort client IP behind Railway's proxy. Prefers X-Real-IP (set by the
 * proxy), else the *last* X-Forwarded-For entry - the first entries are
 * whatever the client sent, so trusting them would let anyone dodge the limit.
 */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  const get = (name: string) => {
    const raw = headers instanceof Headers ? headers.get(name) : headers?.[name];
    return Array.isArray(raw) ? raw[raw.length - 1] : raw;
  };
  const realIp = get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
}
