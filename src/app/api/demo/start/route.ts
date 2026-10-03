import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { demoEnabled, NAMESPACE_COOKIE } from "@/lib/namespace";

/** Switches this browser into the demo namespace. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    if (!demoEnabled()) throw new HttpError(404, "The demo is not enabled in this environment");
    const store = await cookies();
    store.set(NAMESPACE_COOKIE, "demo", { httpOnly: false, sameSite: "lax", path: "/" });
    return json({ namespace: "demo" });
  });
}
