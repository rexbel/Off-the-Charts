import type { NextRequest } from "next/server";
import { errorResponse, readJson } from "@/lib/http";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { buildRequestSchema, type BuildEvent } from "@/lib/schemas";
import { getContext, saveContext } from "@/lib/services/context";
import { runPipeline } from "@/lib/pipeline/run";
import { saveRun } from "@/lib/services/runs";
import { audit } from "@/lib/services/audit";

/**
 * POST /api/patients/[id]/build  → NDJSON stream of BuildEvent.
 * Runs the four-stage pipeline, persists the run, and streams each stage as
 * it finishes so the UI can show partial results. Never streams an unhandled
 * error: the last line is either {type:"complete"} or {type:"error"}.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/patients/[id]/build">) {
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
  if (body.context) await saveContext(patientId, body.context);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: BuildEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await audit("build.started", { patientId }, { mode: body.mode });
        const run = await runPipeline(patient, context, send, { mode: body.mode, signal: req.signal });
        const touchpoints = await saveRun(run);
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
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
