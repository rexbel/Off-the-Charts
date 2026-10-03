import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { NAMESPACE_COOKIE } from "@/lib/namespace";

/** Switches this browser back to live data. Demo data stays until reset. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    const store = await cookies();
    store.delete(NAMESPACE_COOKIE);
    return json({ namespace: "live" });
  });
}
