import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { confirmClaim } from "@/lib/services/runs";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/runs/[runId]/claims/[claimId]/confirm">) {
  return handle(async () => {
    const user = await requireUser(req);
    const { runId, claimId } = await ctx.params;
    const confirmed = await confirmClaim(runId, claimId, user.id, namespaceFromRequest(req));
    if (!confirmed) throw new HttpError(404, "Run not found");
    return json({ confirmedClaimIds: confirmed });
  });
}
