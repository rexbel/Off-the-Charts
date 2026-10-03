import { and, desc, eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "@/db";
import { personaRunSchema, touchpointSchema, type Namespace, type PersonaRun, type Touchpoint } from "@/lib/schemas";
import { touchpointsForRun } from "@/lib/pipeline/touchpoints";
import { audit } from "./audit";
import { HttpError } from "@/lib/http";

function rowToRun(row: typeof schema.personaRuns.$inferSelect): PersonaRun | null {
  try {
    const payload = JSON.parse(row.payload);
    const parsed = personaRunSchema.safeParse({ ...payload, id: row.id, patientId: row.patientId, createdAt: row.createdAt, source: row.source, namespace: row.namespace, approvedAt: row.approvedAt, approvedBy: row.approvedBy, confirmedClaimIds: JSON.parse(row.confirmedClaimIds) });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function rowToTouchpoint(row: typeof schema.touchpoints.$inferSelect): Touchpoint | null {
  const parsed = touchpointSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** Persists a finished run and its pending touchpoints. Idempotent on run id. */
export async function saveRun(run: PersonaRun, actorId: string | null = null): Promise<Touchpoint[]> {
  await ready();
  const tps = touchpointsForRun(run).map((t) => ({ ...t, preparedBy: actorId }));
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.personaRuns)
      .values({ id: run.id, patientId: run.patientId, namespace: run.namespace, createdAt: run.createdAt, source: run.source, payload: JSON.stringify(run), confirmedClaimIds: JSON.stringify(run.confirmedClaimIds) })
      .onConflictDoNothing();
    if (tps.length) await tx.insert(schema.touchpoints).values(tps).onConflictDoNothing();
  });
  await audit("run.saved", { patientId: run.patientId, runId: run.id, actorId }, { source: run.source, namespace: run.namespace, touchpoints: tps.length, stages: run.stages.map((s) => `${s.stage}:${s.source}`).join(",") });
  return tps;
}

/** Marks a run as approved (first clinician approval wins; later ones refresh the time). */
export async function markRunApproved(runId: string, actorId: string | null): Promise<void> {
  await ready();
  await db.update(schema.personaRuns).set({ approvedAt: new Date().toISOString(), approvedBy: actorId }).where(eq(schema.personaRuns.id, runId));
}

/** Clears the marker when no approved touchpoint remains on the run. */
export async function refreshRunApproval(runId: string): Promise<void> {
  await ready();
  const remaining = await db.select({ id: schema.touchpoints.id }).from(schema.touchpoints).where(and(eq(schema.touchpoints.runId, runId), inArray(schema.touchpoints.status, ["approved", "edited"]))).limit(1);
  if (remaining.length === 0) await db.update(schema.personaRuns).set({ approvedAt: null, approvedBy: null }).where(eq(schema.personaRuns.id, runId));
}

export async function getRun(runId: string): Promise<{ run: PersonaRun; touchpoints: Touchpoint[] } | null> {
  await ready();
  const row = await db.query.personaRuns.findFirst({ where: eq(schema.personaRuns.id, runId) });
  if (!row) return null;
  const run = rowToRun(row);
  if (!run) return null;
  const tps = (await db.query.touchpoints.findMany({ where: eq(schema.touchpoints.runId, runId) })).map(rowToTouchpoint).filter((t): t is Touchpoint => t !== null);
  return { run, touchpoints: sortTouchpoints(tps) };
}

export async function latestRunForPatient(patientId: number, namespace: Namespace = "live"): Promise<{ run: PersonaRun; touchpoints: Touchpoint[] } | null> {
  await ready();
  const row = await db.query.personaRuns.findFirst({ where: and(eq(schema.personaRuns.patientId, patientId), eq(schema.personaRuns.namespace, namespace)), orderBy: [desc(schema.personaRuns.createdAt)] });
  if (!row) return null;
  return getRun(row.id);
}

export async function listRunsForPatient(patientId: number, namespace: Namespace = "live"): Promise<Pick<PersonaRun, "id" | "createdAt" | "source" | "approvedAt">[]> {
  await ready();
  const rows = await db
    .select({ id: schema.personaRuns.id, createdAt: schema.personaRuns.createdAt, source: schema.personaRuns.source, approvedAt: schema.personaRuns.approvedAt })
    .from(schema.personaRuns)
    .where(and(eq(schema.personaRuns.patientId, patientId), eq(schema.personaRuns.namespace, namespace)))
    .orderBy(desc(schema.personaRuns.createdAt));
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, source: r.source as PersonaRun["source"], approvedAt: r.approvedAt }));
}

/** Latest run id per patient plus approval counts, for the cohort board. */
export async function latestRunSummaries(namespace: Namespace = "live"): Promise<Map<number, { id: string; createdAt: string; source: PersonaRun["source"]; approvedCount: number; touchpointCount: number }>> {
  await ready();
  const rows = await db
    .select({ id: schema.personaRuns.id, patientId: schema.personaRuns.patientId, createdAt: schema.personaRuns.createdAt, source: schema.personaRuns.source })
    .from(schema.personaRuns)
    .where(eq(schema.personaRuns.namespace, namespace))
    .orderBy(desc(schema.personaRuns.createdAt));
  const latest = new Map<number, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.patientId)) latest.set(r.patientId, r);
  const ids = [...latest.values()].map((r) => r.id);
  const tps = ids.length ? await db.select({ runId: schema.touchpoints.runId, status: schema.touchpoints.status }).from(schema.touchpoints).where(inArray(schema.touchpoints.runId, ids)) : [];
  const out = new Map<number, { id: string; createdAt: string; source: PersonaRun["source"]; approvedCount: number; touchpointCount: number }>();
  for (const [pid, r] of latest) {
    const mine = tps.filter((t) => t.runId === r.id);
    out.set(pid, {
      id: r.id,
      createdAt: r.createdAt,
      source: r.source as PersonaRun["source"],
      approvedCount: mine.filter((t) => t.status === "approved" || t.status === "edited").length,
      touchpointCount: mine.length,
    });
  }
  return out;
}

export async function confirmClaim(runId: string, claimId: string, actorId: string | null = null, namespace: Namespace = "live"): Promise<string[] | null> {
  await ready();
  const row = await db.query.personaRuns.findFirst({ where: eq(schema.personaRuns.id, runId) });
  if (!row) return null;
  if (row.namespace !== namespace) throw new HttpError(403, "That run belongs to another workspace");
  const run = rowToRun(row);
  const known = run ? new Set([...run.profile.emotionalContext, ...run.profile.cognitiveSupport, ...run.profile.strengths, ...run.profile.privacyRules].map((c) => c.id)) : new Set<string>();
  if (!known.has(claimId)) throw new HttpError(404, "That claim is not part of this run");
  const ids = new Set<string>(JSON.parse(row.confirmedClaimIds) as string[]);
  ids.add(claimId);
  const next = [...ids];
  await db.update(schema.personaRuns).set({ confirmedClaimIds: JSON.stringify(next) }).where(eq(schema.personaRuns.id, runId));
  await audit("claim.confirmed", { patientId: row.patientId, runId, actorId }, { claimId });
  return next;
}

const KIND_ORDER = ["message_before_7d", "message_before_2d", "message_after_24h", "brief", "summary", "video_before", "video_after"];
export function sortTouchpoints(tps: Touchpoint[]): Touchpoint[] {
  return [...tps].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export async function listAllRuns(namespace: Namespace = "live"): Promise<PersonaRun[]> {
  await ready();
  const rows = await db.query.personaRuns.findMany({ where: eq(schema.personaRuns.namespace, namespace), orderBy: [desc(schema.personaRuns.createdAt)] });
  return rows.map(rowToRun).filter((r): r is PersonaRun => r !== null);
}
