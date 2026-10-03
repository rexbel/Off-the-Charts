import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, HttpError, json, readJson } from "@/lib/http";
import { assertSameSite, createSession, quickSigninEnabled, quickSigninUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { audit } from "@/lib/services/audit";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const quickSchema = z.object({ email: z.string().email().max(200) });

/** POST /api/auth/quick: one-click demo sign-in as the seeded coordinator or clinician. 404 unless enabled. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    if (!quickSigninEnabled()) throw new HttpError(404, "Not found");
    assertSameSite(req);
    const limit = rateLimit(`login:${clientKey(req)}`, 10, 60_000);
    if (!limit.ok) throw new HttpError(429, `Too many sign-in attempts. Try again in ${limit.retryAfterSeconds} seconds.`);
    const { email } = await readJson(req, (raw) => quickSchema.parse(raw));
    const user = await quickSigninUser(email);
    if (!user) throw new HttpError(403, "That account needs a password.");
    const session = await createSession(user.id);
    const store = await cookies();
    store.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
    await audit("auth.login", { actorId: user.id }, { role: user.role, quick: true });
    return json({ user });
  });
}
