import { desc, eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "@/db";
import { personaRunSchema, touchpointSchema, type PersonaRun, type Touchpoint } from "@/lib/schemas";
import { touchpointsForRun } from "@/lib/pipeline/touchpoints";
import { audit } from "./audit";

function rowToRun(row: typeof schema.personaRuns.$inferSelect): PersonaRun | null {
  try {
    const payload = JSON.parse(row.payload);
    const parsed = personaRunSchema.safeParse({ ...payload, id: row.id, patientId: row.patientId, createdAt: row.createdAt, source: row.source, confirmedClaimIds: JSON.parse(row.confirmedClaimIds) });
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
export async function saveRun(run: PersonaRun): Promise<Touchpoint[]> {
  await ready();
  const tps = touchpointsForRun(run);
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.personaRuns)
      .values({ id: run.id, patientId: run.patientId, createdAt: run.createdAt, source: run.source, payload: JSON.stringify(run), confirmedClaimIds: JSON.stringify(run.confirmedClaimIds) })
      .onConflictDoNothing();
    if (tps.length) await tx.insert(schema.touchpoints).values(tps).onConflictDoNothing();
  });
  await audit("run.saved", { patientId: run.patientId, runId: run.id }, { source: run.source, touchpoints: tps.length, stages: run.stages.map((s) => `${s.stage}:${s.source}`).join(",") });
  return tps;
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

export async function latestRunForPatient(patientId: number): Promise<{ run: PersonaRun; touchpoints: Touchpoint[] } | null> {
  await ready();
  const row = await db.query.personaRuns.findFirst({ where: eq(schema.personaRuns.patientId, patientId), orderBy: [desc(schema.personaRuns.createdAt)] });
  if (!row) return null;
  return getRun(row.id);
}

export async function listRunsForPatient(patientId: number): Promise<Pick<PersonaRun, "id" | "createdAt" | "source">[]> {
  await ready();
  const rows = await db
    .select({ id: schema.personaRuns.id, createdAt: schema.personaRuns.createdAt, source: schema.personaRuns.source })
    .from(schema.personaRuns)
    .where(eq(schema.personaRuns.patientId, patientId))
    .orderBy(desc(schema.personaRuns.createdAt));
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, source: r.source as PersonaRun["source"] }));
}

/** Latest run id per patient plus approval counts, for the cohort board. */
export async function latestRunSummaries(): Promise<Map<number, { id: string; createdAt: string; source: PersonaRun["source"]; approvedCount: number; touchpointCount: number }>> {
  await ready();
  const rows = await db
    .select({ id: schema.personaRuns.id, patientId: schema.personaRuns.patientId, createdAt: schema.personaRuns.createdAt, source: schema.personaRuns.source })
    .from(schema.personaRuns)
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

export async function confirmClaim(runId: string, claimId: string): Promise<string[] | null> {
  await ready();
  const row = await db.query.personaRuns.findFirst({ where: eq(schema.personaRuns.id, runId) });
  if (!row) return null;
  const ids = new Set<string>(JSON.parse(row.confirmedClaimIds) as string[]);
  ids.add(claimId);
  const next = [...ids];
  await db.update(schema.personaRuns).set({ confirmedClaimIds: JSON.stringify(next) }).where(eq(schema.personaRuns.id, runId));
  await audit("claim.confirmed", { patientId: row.patientId, runId }, { claimId });
  return next;
}

const KIND_ORDER = ["message_before_7d", "message_before_2d", "message_after_24h", "brief", "summary", "video_before", "video_after"];
export function sortTouchpoints(tps: Touchpoint[]): Touchpoint[] {
  return [...tps].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export async function listAllRuns(): Promise<PersonaRun[]> {
  await ready();
  const rows = await db.query.personaRuns.findMany({ orderBy: [desc(schema.personaRuns.createdAt)] });
  return rows.map(rowToRun).filter((r): r is PersonaRun => r !== null);
}
