import { noId, ready } from "@/db";
import { patientContextSchema, type PatientContext, type PatientRecord } from "@/lib/schemas";
import { nowIso } from "@/lib/ids";

/** The seeded default context for a patient (what the check-in form starts with). */
export function defaultContext(record: PatientRecord): PatientContext {
  return {
    checkin: record.seed.whatMattersCheckin,
    audience: record.seed.audience,
    language: record.seed.statedLanguage,
    channel: "sms",
  };
}

export async function getContext(record: PatientRecord): Promise<{ context: PatientContext; edited: boolean }> {
  const db = await ready();
  const row = await db.patientContexts.findOne({ patientId: record.patientId }, noId);
  if (!row) return { context: defaultContext(record), edited: false };
  const parsed = patientContextSchema.safeParse({ checkin: row.checkin, audience: row.audience, language: row.language, channel: row.channel });
  return parsed.success ? { context: parsed.data, edited: true } : { context: defaultContext(record), edited: false };
}

export async function saveContext(patientId: number, context: PatientContext): Promise<void> {
  const db = await ready();
  await db.patientContexts.updateOne({ patientId }, { $set: { ...context, updatedAt: nowIso() } }, { upsert: true });
}

export async function clearContext(patientId: number): Promise<void> {
  const db = await ready();
  await db.patientContexts.deleteOne({ patientId });
}
