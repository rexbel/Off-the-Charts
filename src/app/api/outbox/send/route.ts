import type { NextRequest } from "next/server";
import { handle, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { sendRequestSchema } from "@/lib/schemas";
import { sendTouchpoints } from "@/lib/services/deliveries";

/** Simulated send. Clinician or admin only; privacy is re-checked per touchpoint. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ["clinician"]);
    const body = await readJson(req, (raw) => sendRequestSchema.parse(raw));
    return json({ deliveries: await sendTouchpoints(body.touchpointIds, user, namespaceFromRequest(req)) });
  });
}
