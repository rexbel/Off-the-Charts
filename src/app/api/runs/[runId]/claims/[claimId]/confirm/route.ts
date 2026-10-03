import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { confirmClaim } from "@/lib/services/runs";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/runs/[runId]/claims/[claimId]/confirm">) {
  return handle(async () => {
    const { runId, claimId } = await ctx.params;
    const confirmed = await confirmClaim(runId, claimId);
    if (!confirmed) throw new HttpError(404, "Run not found");
    return json({ confirmedClaimIds: confirmed });
  });
}
