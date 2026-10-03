import type { NextRequest } from "next/server";
import { handle, HttpError, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { rewriteRequestSchema } from "@/lib/schemas";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { listRewrites, rewriteMessage } from "@/lib/services/rewrite";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req);
    const body = await readJson(req, (raw) => rewriteRequestSchema.parse(raw));
    const patient = getPatient(body.patientId);
    if (!patient) throw new HttpError(404, "Patient not found");
    return json(await rewriteMessage(patient, body, user, namespaceFromRequest(req)));
  });
}

/** GET /api/rewrite?patientId= → recent rewrites for that patient in this namespace. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    const pid = parsePatientId(req.nextUrl.searchParams.get("patientId") ?? "");
    if (!pid || !getPatient(pid)) throw new HttpError(404, "Patient not found");
    return json({ rewrites: await listRewrites(pid, namespaceFromRequest(req)) });
  });
}
