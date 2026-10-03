/**
 * Small in-memory rate limiter. Per process; good enough for a single
 * instance and a clear signal for an edge/WAF rule later.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  b.count += 1;
  if (b.count > max) return { ok: false, retryAfterSeconds: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Client key for unauthenticated limits. Uses the LAST hop of x-forwarded-for
 * (the one the nearest trusted proxy appended), never the client-supplied
 * first hop.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const hops = fwd ? fwd.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return hops[hops.length - 1] || req.headers.get("x-real-ip") || "local";
}
