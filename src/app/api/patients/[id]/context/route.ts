import type { NextRequest } from "next/server";
import { handle, HttpError, json, readJson } from "@/lib/http";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { patientContextSchema } from "@/lib/schemas";
import { clearContext, defaultContext, saveContext } from "@/lib/services/context";
import { audit } from "@/lib/services/audit";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/patients/[id]/context">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const patientId = parsePatientId(id);
    const patient = patientId ? getPatient(patientId) : undefined;
    if (!patient || !patientId) throw new HttpError(404, "Patient not found");
    const context = await readJson(req, (raw) => patientContextSchema.parse(raw));
    await saveContext(patientId, context);
    await audit("context.saved", { patientId }, { audience: context.audience, language: context.language, channel: context.channel, checkinChars: context.checkin.length });
    return json({ context, contextEdited: true });
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/patients/[id]/context">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const patientId = parsePatientId(id);
    const patient = patientId ? getPatient(patientId) : undefined;
    if (!patient || !patientId) throw new HttpError(404, "Patient not found");
    await clearContext(patientId);
    return json({ context: defaultContext(patient), contextEdited: false });
  });
}
