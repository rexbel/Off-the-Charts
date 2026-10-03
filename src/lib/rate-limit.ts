/**
 * Small in-memory rate limiter for sign-in attempts. Per process; good
 * enough for a single instance and a clear signal for an edge/WAF rule later.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  b.count += 1;
  if (b.count > max) return { ok: false, retryAfterSeconds: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfterSeconds: 0 };
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : null)?.trim() || req.headers.get("x-real-ip") || "local";
}
