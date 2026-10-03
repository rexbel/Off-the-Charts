import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { getRun } from "@/lib/services/runs";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/runs/[runId]">) {
  return handle(async () => {
    const { runId } = await ctx.params;
    const bundle = await getRun(runId);
    if (!bundle) throw new HttpError(404, "Run not found");
    return json(bundle);
  });
}
