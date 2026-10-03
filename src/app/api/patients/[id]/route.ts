import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { defaultContext, getContext } from "@/lib/services/context";
import { latestRunForPatient, listRunsForPatient } from "@/lib/services/runs";
import { loadCachedRun } from "@/lib/pipeline/cached";
import { modelAvailable } from "@/lib/ai/provider";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/patients/[id]">) {
  return handle(async () => {
    await requireUser(req);
    const ns = namespaceFromRequest(req);
    const { id } = await ctx.params;
    const patientId = parsePatientId(id);
    const patient = patientId ? getPatient(patientId) : undefined;
    if (!patient || !patientId) throw new HttpError(404, "Patient not found");
    const [{ context, edited }, latest, runs, cached] = await Promise.all([
      ns === "live" ? getContext(patient) : Promise.resolve({ context: defaultContext(patient), edited: false }),
      latestRunForPatient(patientId, ns),
      listRunsForPatient(patientId, ns),
      loadCachedRun(patientId),
    ]);
    return json({ patient, context, contextEdited: edited, latest, runs, cachedAvailable: cached !== null, modelAvailable: modelAvailable(), namespace: ns });
  });
}
