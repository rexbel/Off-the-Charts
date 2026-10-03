import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/http";
import { destroySession, SESSION_COOKIE, userFromRequest } from "@/lib/auth";
import { NAMESPACE_COOKIE } from "@/lib/namespace";
import { audit } from "@/lib/services/audit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await userFromRequest(req);
    const store = await cookies();
    const sid = store.get(SESSION_COOKIE)?.value;
    if (sid) await destroySession(sid);
    store.delete(SESSION_COOKIE);
    store.delete(NAMESPACE_COOKIE);
    if (user) await audit("auth.logout", { actorId: user.id }, {});
    return json({ ok: true });
  });
}
