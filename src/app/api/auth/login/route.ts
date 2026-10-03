import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { handle, HttpError, json, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/schemas";
import { authenticate, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { audit } from "@/lib/services/audit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email, password } = await readJson(req, (raw) => loginSchema.parse(raw));
    const user = await authenticate(email, password);
    if (!user) {
      await audit("auth.login_failed", {}, {});
      throw new HttpError(401, "That email and password didn't match.");
    }
    const session = await createSession(user.id);
    const store = await cookies();
    store.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
    await audit("auth.login", { actorId: user.id }, { role: user.role });
    return json({ user });
  });
}
