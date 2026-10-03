import type { NextRequest } from "next/server";
import { handle, HttpError, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { createCheckin, listCheckins } from "@/lib/services/checkins";

function resolvePatient(id: string): number {
  const patientId = parsePatientId(id);
  if (!patientId || !getPatient(patientId)) throw new HttpError(404, "Patient not found");
  return patientId;
}

/** Newest first. Staff only. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/patients/[id]/checkins">) {
  return handle(async () => {
    await requireUser(req);
    const { id } = await ctx.params;
    const patientId = resolvePatient(id);
    const checkins = await listCheckins(patientId);
    return json({ checkins });
  });
}

/** Creates a fresh token link (14 days). Earlier links stay valid until they expire or are used. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/patients/[id]/checkins">) {
  return handle(async () => {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const patientId = resolvePatient(id);
    const checkin = await createCheckin(patientId, user.id);
    return json({ checkin }, { status: 201 });
  });
}
