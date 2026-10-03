import { eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "@/db";
import type { AuditEvent } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";

/**
 * Audit events carry ids, kinds and counts. Never message text, note text or
 * check-in text.
 */
export async function audit(action: string, ids: { patientId?: number; runId?: string; touchpointId?: string; actorId?: string | null }, meta: Record<string, string | number | boolean | null> = {}): Promise<void> {
  await ready();
  await db.insert(schema.auditEvents).values({
    id: newId("ev"),
    at: nowIso(),
    action,
    actorId: ids.actorId ?? null,
    patientId: ids.patientId ?? null,
    runId: ids.runId ?? null,
    touchpointId: ids.touchpointId ?? null,
    meta: JSON.stringify(meta),
  });
}

export async function recentAudit(opts: { patientId?: number; limit?: number } = {}): Promise<AuditEvent[]> {
  await ready();
  const rows = await db.query.auditEvents.findMany({
    where: opts.patientId !== undefined ? eq(schema.auditEvents.patientId, opts.patientId) : undefined,
    orderBy: (t, { desc }) => [desc(t.at)],
    limit: opts.limit ?? 100,
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))];
  const users = actorIds.length ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, actorIds)) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    action: r.action,
    actorId: r.actorId,
    actorName: r.actorId ? (names.get(r.actorId) ?? null) : null,
    patientId: r.patientId,
    runId: r.runId,
    touchpointId: r.touchpointId,
    meta: safeMeta(r.meta),
  }));
}

function safeMeta(raw: string): AuditEvent["meta"] {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as AuditEvent["meta"]) : {};
  } catch {
    return {};
  }
}
