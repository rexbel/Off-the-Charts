import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { demoEnabled } from "@/lib/namespace";
import { resetDemo } from "@/lib/services/demo";

/** Clears demo-namespace data only. Live runs are never touched. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    if (!demoEnabled()) throw new HttpError(404, "The demo is not enabled in this environment");
    return json(await resetDemo(user.id));
  });
}
