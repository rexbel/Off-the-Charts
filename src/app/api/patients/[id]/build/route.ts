import type { NextRequest } from "next/server";
import { errorResponse, readJson } from "@/lib/http";
import { userFromRequest } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { buildRequestSchema, type BuildEvent } from "@/lib/schemas";
import { getContext, saveContext } from "@/lib/services/context";
import { runPipeline } from "@/lib/pipeline/run";
import { saveRun } from "@/lib/services/runs";
import { audit } from "@/lib/services/audit";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/patients/[id]/build  → NDJSON stream of BuildEvent.
 * Runs the four-stage pipeline in the request's namespace, persists the run,
 * and streams each stage as it finishes. The last line is always
 * {type:"complete"} or {type:"error"}.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/patients/[id]/build">) {
  const user = await userFromRequest(req);
  if (!user) return errorResponse(401, "Sign in to continue");
  // Each build can be three model calls; cap spend per user.
  const limit = rateLimit(`build:${user.id}`, 30, 10 * 60_000);
  if (!limit.ok) return errorResponse(429, `Too many builds. Try again in ${limit.retryAfterSeconds} seconds.`);
  const ns = namespaceFromRequest(req);
  const { id } = await ctx.params;
  const patientId = parsePatientId(id);
  const patient = patientId ? getPatient(patientId) : undefined;
  if (!patient || !patientId) return errorResponse(404, "Patient not found");

  let body;
  try {
    body = await readJson(req, (raw) => buildRequestSchema.parse(raw ?? {}));
  } catch (err) {
    return errorResponse(400, err instanceof Error ? err.message : "Invalid request");
  }

  const context = body.context ?? (await getContext(patient)).context;
  if (body.context && ns === "live") await saveContext(patientId, body.context);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: BuildEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await audit("build.started", { patientId, actorId: user.id }, { mode: body.mode, namespace: ns });
        const run = await runPipeline(patient, context, send, { mode: body.mode, signal: req.signal, namespace: ns });
        const touchpoints = await saveRun(run, user.id);
        send({ type: "complete", run, touchpoints });
      } catch (err) {
        console.error("[build] failed", err instanceof Error ? err.message : err);
        send({ type: "error", message: "The build could not finish. Nothing was sent. Try again, or open the last saved run." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
