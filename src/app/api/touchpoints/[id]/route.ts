import type { NextRequest } from "next/server";
import { handle, json, readJson } from "@/lib/http";
import { touchpointActionSchema } from "@/lib/schemas";
import { applyTouchpointAction } from "@/lib/services/touchpoints";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/touchpoints/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const action = await readJson(req, (raw) => touchpointActionSchema.parse(raw));
    return json(await applyTouchpointAction(id, action));
  });
}
