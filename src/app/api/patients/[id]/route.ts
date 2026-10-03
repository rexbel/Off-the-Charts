import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { getContext } from "@/lib/services/context";
import { latestRunForPatient, listRunsForPatient } from "@/lib/services/runs";
import { loadCachedRun } from "@/lib/pipeline/cached";
import { modelAvailable } from "@/lib/ai/provider";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/patients/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const patientId = parsePatientId(id);
    const patient = patientId ? getPatient(patientId) : undefined;
    if (!patient || !patientId) throw new HttpError(404, "Patient not found");
    const [{ context, edited }, latest, runs, cached] = await Promise.all([
      getContext(patient),
      latestRunForPatient(patientId),
      listRunsForPatient(patientId),
      loadCachedRun(patientId),
    ]);
    return json({
      patient,
      context,
      contextEdited: edited,
      latest,
      runs,
      cachedAvailable: cached !== null,
      modelAvailable: modelAvailable(),
    });
  });
}
