import type { NextRequest } from "next/server";
import { handle, HttpError, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rewriteRequestSchema } from "@/lib/schemas";
import { getPatient } from "@/lib/data/cohort";
import { rewriteMessage } from "@/lib/services/rewrite";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    const body = await readJson(req, (raw) => rewriteRequestSchema.parse(raw));
    const patient = getPatient(body.patientId);
    if (!patient) throw new HttpError(404, "Patient not found");
    return json(await rewriteMessage(patient, body));
  });
}
