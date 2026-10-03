import { eq } from "drizzle-orm";
import { db, ready, schema } from "@/db";
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
  await ready();
  const row = await db.query.patientContexts.findFirst({ where: eq(schema.patientContexts.patientId, record.patientId) });
  if (!row) return { context: defaultContext(record), edited: false };
  const parsed = patientContextSchema.safeParse({ checkin: row.checkin, audience: row.audience, language: row.language, channel: row.channel });
  return parsed.success ? { context: parsed.data, edited: true } : { context: defaultContext(record), edited: false };
}

export async function saveContext(patientId: number, context: PatientContext): Promise<void> {
  await ready();
  await db
    .insert(schema.patientContexts)
    .values({ patientId, ...context, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: schema.patientContexts.patientId, set: { ...context, updatedAt: nowIso() } });
}

export async function clearContext(patientId: number): Promise<void> {
  await ready();
  await db.delete(schema.patientContexts).where(eq(schema.patientContexts.patientId, patientId));
}
