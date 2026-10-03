import { db, ready, schema } from "@/db";
import { newId, nowIso } from "@/lib/ids";

/**
 * Audit events carry ids, kinds and counts. Never message text, note text or
 * check-in text.
 */
export async function audit(action: string, ids: { patientId?: number; runId?: string; touchpointId?: string }, meta: Record<string, string | number | boolean | null> = {}): Promise<void> {
  await ready();
  await db.insert(schema.auditEvents).values({
    id: newId("ev"),
    at: nowIso(),
    action,
    patientId: ids.patientId ?? null,
    runId: ids.runId ?? null,
    touchpointId: ids.touchpointId ?? null,
    meta: JSON.stringify(meta),
  });
}

export async function recentAudit(limit = 50) {
  await ready();
  return db.query.auditEvents.findMany({ orderBy: (t, { desc }) => [desc(t.at)], limit });
}
