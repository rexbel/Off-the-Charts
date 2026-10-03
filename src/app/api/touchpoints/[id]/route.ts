import type { NextRequest } from "next/server";
import { handle, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { touchpointActionSchema } from "@/lib/schemas";
import { applyTouchpointAction } from "@/lib/services/touchpoints";

/** approve needs a clinician (403 otherwise); edit/reject/reset any signed-in user; 409 on a privacy block. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/touchpoints/[id]">) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const action = await readJson(req, (raw) => touchpointActionSchema.parse(raw));
    return json(await applyTouchpointAction(id, action, user));
  });
}
