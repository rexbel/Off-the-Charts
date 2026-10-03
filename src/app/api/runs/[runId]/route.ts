import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getRun } from "@/lib/services/runs";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/runs/[runId]">) {
  return handle(async () => {
    await requireUser(req);
    const { runId } = await ctx.params;
    const bundle = await getRun(runId);
    if (!bundle) throw new HttpError(404, "Run not found");
    return json(bundle);
  });
}
